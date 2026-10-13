-- =============================================================================
-- Cost Granularity - PostgreSQL schema
-- Source: Cost_Granularity_Sample_Data_v2.xlsx (synthetic PoC data)
--
-- Design notes
--   * Natural business keys (PO number, WBS element, investment code, ...) are
--     the primary keys: they are stable, unique in the source and what every
--     consumer joins on. Format CHECKs guard against junk keys.
--   * Only INPUT values are stored. Every Excel formula column (YTD totals,
--     'In Copperleaf?', PO actual lookups, allocated amounts, unallocated
--     differences, the two pivot sheets) is a view, so it can never drift.
--   * Monthly SAP actuals are unpivoted to one row per WBS x fiscal period.
--   * The workbook deliberately contains data-quality issues (sheet
--     'Seeded Exceptions'). Constraints enforce structure, NOT business rules
--     that the planted issues break, so every issue survives the load and can
--     be detected in SQL. Where a hard FK would reject a planted issue, the
--     column is a documented soft reference instead.
--   * Money is numeric(15,2) (GBP); never float.
--
-- Idempotent: drops and recreates the schema.
-- =============================================================================

BEGIN;

DROP SCHEMA IF EXISTS cost_granularity CASCADE;
CREATE SCHEMA cost_granularity;
COMMENT ON SCHEMA cost_granularity IS
    'Cost Granularity synthetic sample data (v2). A gas transmission operator delivering '
    'asset-health investments planned in Copperleaf (RIIO-T3 submission, 23/24 price base) and '
    'executed as SAP S/4 projects/WBS. FY starts April; actuals cover periods 1-6 (Apr-Sep 2026). '
    'Summary-level POs are split across projects/WBS in po_allocation; SAP WBS actuals = internal '
    'costs + PO allocations, reconciling except where an issue is deliberately planted.';

SET search_path = cost_granularity;

-- -----------------------------------------------------------------------------
-- Load lineage
-- -----------------------------------------------------------------------------
CREATE TABLE etl_load (
    load_id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_file   text        NOT NULL,
    source_sha256 char(64)    NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
    row_counts    jsonb       NOT NULL,
    loaded_at     timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE etl_load IS 'One row per workbook load: source file, checksum and per-table row counts.';

-- -----------------------------------------------------------------------------
-- Reference data
-- -----------------------------------------------------------------------------
CREATE TABLE fiscal_period (
    fiscal_year  smallint NOT NULL CHECK (fiscal_year BETWEEN 2000 AND 2100),
    period       smallint NOT NULL CHECK (period BETWEEN 1 AND 12),
    period_start date     NOT NULL,
    period_end   date     NOT NULL,
    PRIMARY KEY (fiscal_year, period),
    UNIQUE (period_start),
    CHECK (period_end >= period_start)
);
COMMENT ON TABLE  fiscal_period IS 'SAP posting periods. Fiscal year starts 1 April; fiscal_year is the starting calendar year (2026 = FY 2026/27).';

CREATE TABLE regulatory_activity (
    activity_code text PRIMARY KEY CHECK (activity_code ~ '^[A-Z0-9]{3}$'),
    description   text    NOT NULL,
    is_placeholder boolean NOT NULL DEFAULT false
);
COMMENT ON TABLE  regulatory_activity IS 'WBS regulatory activity codes (SAP Data col N/O).';
COMMENT ON COLUMN regulatory_activity.is_placeholder IS 'True for dummy / pending codes (W99, QQQ) that are not attributable to a real regulatory activity.';

CREATE TABLE allocation_basis (
    allocation_basis text PRIMARY KEY
);
COMMENT ON TABLE allocation_basis IS 'Methods for splitting a PO actual across projects/WBS (PO Summary col K / Actual Allocation col H).';

CREATE TABLE site (
    site_id   text PRIMARY KEY CHECK (site_id ~ '^S-\d{5}$'),
    site_name text NOT NULL UNIQUE,
    area      text NOT NULL
);
COMMENT ON TABLE  site IS 'Operational sites (Copperleaf Site/SiteId/Facility/Area). Facility always equals Site in the source.';
COMMENT ON COLUMN site.area IS 'Operating region, e.g. North Region.';

CREATE TABLE supplier (
    supplier_id text PRIMARY KEY CHECK (supplier_id ~ '^SUP-\d{4}$')
);

CREATE TABLE contract (
    contract_ref text NOT NULL PRIMARY KEY,
    supplier_id  text NOT NULL REFERENCES supplier,
    UNIQUE (contract_ref, supplier_id)          -- target for purchase_order composite FK
);
CREATE INDEX contract_supplier_idx ON contract (supplier_id);
COMMENT ON TABLE contract IS 'Framework / NEC4 contracts. Each contract belongs to exactly one supplier.';

-- -----------------------------------------------------------------------------
-- SAP (execution / posting grain)
-- -----------------------------------------------------------------------------
CREATE TABLE sap_project (
    project_definition text PRIMARY KEY CHECK (project_definition ~ '^GT-P\d{4}$'),
    project_name       text NOT NULL,
    company_code       text NOT NULL CHECK (company_code ~ '^[A-Z0-9]{4}$'),
    person_responsible text NOT NULL,
    initiative_id      text NOT NULL CHECK (initiative_id ~ '^INI-\d{5}$'),
    scheme_ref         text NOT NULL
);
CREATE INDEX sap_project_initiative_idx ON sap_project (initiative_id);
COMMENT ON TABLE  sap_project IS 'SAP project definitions. Attributes are constant across all WBS of a project in the source (verified at load).';
COMMENT ON COLUMN sap_project.scheme_ref IS 'Scheme No / Proj Ref; should equal the Copperleaf PAC code. Placeholder ''TEMPLATE'' is a known issue (L4), mismatches are L3.';

CREATE TABLE wbs_element (
    wbs_element        text PRIMARY KEY CHECK (wbs_element ~ '^GT-P\d{4}(\.\d{2})+$'),
    project_definition text NOT NULL REFERENCES sap_project,
    description        text NOT NULL,
    object_class       text NOT NULL,
    activity_code      text NOT NULL REFERENCES regulatory_activity,
    wbs_level          smallint GENERATED ALWAYS AS
                         (length(wbs_element) - length(replace(wbs_element, '.', ''))) STORED,
    CHECK (wbs_element LIKE project_definition || '.%')
);
CREATE INDEX wbs_element_project_idx  ON wbs_element (project_definition);
CREATE INDEX wbs_element_activity_idx ON wbs_element (activity_code);
COMMENT ON TABLE  wbs_element IS 'SAP WBS elements. Hierarchy is implied by the dotted code; intermediate levels (e.g. .02) are not always present as postable elements.';
COMMENT ON COLUMN wbs_element.object_class IS 'SAP object class (IV = investment).';
COMMENT ON COLUMN wbs_element.wbs_level   IS 'Depth below the project: GT-P0280.01 = 1, GT-P0280.01.02 = 2.';

CREATE TABLE sap_wbs_actual (
    wbs_element text          NOT NULL REFERENCES wbs_element,
    fiscal_year smallint      NOT NULL,
    period      smallint      NOT NULL,
    amount      numeric(15,2) NOT NULL,
    PRIMARY KEY (wbs_element, fiscal_year, period),
    FOREIGN KEY (fiscal_year, period) REFERENCES fiscal_period
);
CREATE INDEX sap_wbs_actual_period_idx ON sap_wbs_actual (fiscal_year, period);
COMMENT ON TABLE  sap_wbs_actual IS 'WBS actuals by posting period (SAP Data cols P-AA, unpivoted). Empty periods are absent, not zero. Negative amounts are legitimate (accruals/reversals, credit notes).';

-- -----------------------------------------------------------------------------
-- Copperleaf (planning / analytical grain)
-- -----------------------------------------------------------------------------
CREATE TABLE copperleaf_investment (
    investment_code            text PRIMARY KEY CHECK (investment_code ~ '^INV-\d{5}$'),
    investment_name            text NOT NULL,
    site_id                    text NOT NULL REFERENCES site,
    final_submission_inv_id_t3 text NOT NULL CHECK (final_submission_inv_id_t3 ~ '^C-\d{3}$'),
    final_submission_volume_t3 integer NOT NULL CHECK (final_submission_volume_t3 >= 0),
    investment_volume          integer NOT NULL CHECK (investment_volume >= 0),
    inv_id_code                text NOT NULL,
    price_base                 text CHECK (price_base ~ '^\d{2}/\d{2}$'),
    product                    text NOT NULL,
    funding_position_t3        text NOT NULL,
    intervention_driver        text,
    sap_project                text REFERENCES sap_project,
    percentage_of_wbs          numeric(5,2) CHECK (percentage_of_wbs BETWEEN 0 AND 100),
    idt_total_ecc              numeric(15,2) NOT NULL CHECK (idt_total_ecc >= 0),
    pac_code                   text NOT NULL CHECK (pac_code ~ '^PAC-\d{5}$'),
    CHECK ((sap_project IS NULL) = (percentage_of_wbs IS NULL))
);
CREATE INDEX copperleaf_investment_site_idx    ON copperleaf_investment (site_id);
CREATE INDEX copperleaf_investment_project_idx ON copperleaf_investment (sap_project);
CREATE INDEX copperleaf_investment_sub_idx     ON copperleaf_investment (final_submission_inv_id_t3);
CREATE INDEX copperleaf_investment_pac_idx     ON copperleaf_investment (pac_code);
COMMENT ON TABLE  copperleaf_investment IS 'Planned investments, RIIO-T3 submission IDs and the link to SAP.';
COMMENT ON COLUMN copperleaf_investment.price_base        IS 'Price base of entered cost, e.g. 23/24. NULL = missing (known issue C3).';
COMMENT ON COLUMN copperleaf_investment.intervention_driver IS 'NULL = missing (known issue C2).';
COMMENT ON COLUMN copperleaf_investment.sap_project       IS 'Delivering SAP project. NULL = not yet linked (known issue L1).';
COMMENT ON COLUMN copperleaf_investment.percentage_of_wbs IS 'Share (0-100) of the SAP project''s cost attributable to this investment. Per-project totals should be 100 (L5 when not).';
COMMENT ON COLUMN copperleaf_investment.idt_total_ecc     IS 'Total estimated cost (GBP).';

-- -----------------------------------------------------------------------------
-- Procurement (commercial grain)
-- -----------------------------------------------------------------------------
CREATE TABLE purchase_order (
    po_number                  text PRIMARY KEY CHECK (po_number ~ '^PO-\d{10}$'),
    supplier_id                text NOT NULL,
    contract_ref               text NOT NULL,
    description                text NOT NULL,
    po_date                    date NOT NULL,
    currency                   char(3) NOT NULL DEFAULT 'GBP' CHECK (currency ~ '^[A-Z]{3}$'),
    posting_level              text NOT NULL CHECK (posting_level IN ('Summary / programme', 'Project')),
    summary_project_definition text REFERENCES sap_project,
    po_value                   numeric(15,2) NOT NULL CHECK (po_value >= 0),
    actual_posted              numeric(15,2) NOT NULL,
    allocation_basis           text NOT NULL REFERENCES allocation_basis,
    status                     text NOT NULL CHECK (status IN (
                                   'Open / partly invoiced', 'Open - not yet invoiced',
                                   'Open - overspend risk', 'Closed / fully invoiced')),
    FOREIGN KEY (contract_ref, supplier_id) REFERENCES contract (contract_ref, supplier_id),
    -- 'Project' POs name a single project; summary POs are MULTI-PROJECT (NULL here)
    CHECK ((posting_level = 'Project') = (summary_project_definition IS NOT NULL))
);
CREATE INDEX purchase_order_supplier_idx ON purchase_order (supplier_id);
CREATE INDEX purchase_order_contract_idx ON purchase_order (contract_ref, supplier_id);
CREATE INDEX purchase_order_project_idx  ON purchase_order (summary_project_definition);
CREATE INDEX purchase_order_basis_idx    ON purchase_order (allocation_basis);
COMMENT ON TABLE  purchase_order IS 'Summary-level and project POs (PO Summary cols A-L). Cols M-O are in v_purchase_order_summary.';
COMMENT ON COLUMN purchase_order.summary_project_definition IS 'Summary cost object. NULL means MULTI-PROJECT (posting_level = Summary / programme).';
COMMENT ON COLUMN purchase_order.actual_posted IS 'Actual posted to date (GBP). May exceed po_value (known issue P2).';

CREATE TABLE po_allocation (
    allocation_id      text PRIMARY KEY CHECK (allocation_id ~ '^ALLOC-\d{3}-\d{2}$'),
    po_number          text NOT NULL REFERENCES purchase_order,
    project_definition text NOT NULL REFERENCES sap_project,
    wbs_element        text NOT NULL,
    wbs_description    text NOT NULL,
    initiative_id      text NOT NULL CHECK (initiative_id ~ '^INI-\d{5}$'),
    allocation_pct     numeric(9,6)  NOT NULL CHECK (allocation_pct BETWEEN 0 AND 1),
    manual_adjustment  numeric(15,2) NOT NULL DEFAULT 0,
    allocation_rationale text,
    review_status      text NOT NULL CHECK (review_status IN ('Approved', 'For review', 'Query raised')),
    CHECK (wbs_element LIKE project_definition || '.%')
);
CREATE INDEX po_allocation_po_idx      ON po_allocation (po_number);
CREATE INDEX po_allocation_project_idx ON po_allocation (project_definition);
CREATE INDEX po_allocation_wbs_idx     ON po_allocation (wbs_element);
COMMENT ON TABLE  po_allocation IS 'Manual split of PO actuals to project/WBS (Actual Allocation inputs). Project name and allocation rule are derived from sap_project / purchase_order (verified identical at load). Amounts are in v_po_allocation.';
COMMENT ON COLUMN po_allocation.wbs_element     IS 'Soft reference to wbs_element: NOT a foreign key because allocations to WBS that do not exist in SAP are a real, detectable issue (P3).';
COMMENT ON COLUMN po_allocation.wbs_description IS 'WBS description as entered on the allocation; needed when the WBS does not exist in SAP.';
COMMENT ON COLUMN po_allocation.initiative_id   IS 'Investment / initiative ID as entered. Should equal sap_project.initiative_id (P5 when not).';
COMMENT ON COLUMN po_allocation.allocation_pct  IS 'Fraction 0-1 of the PO actual. Per-PO totals should be 1 (P1 when not).';

-- -----------------------------------------------------------------------------
-- PoC answer key
-- -----------------------------------------------------------------------------
CREATE TABLE seeded_exception (
    check_id        text PRIMARY KEY CHECK (check_id ~ '^[A-Z]\d+$'),
    check_name      text NOT NULL,
    source_sheet    text NOT NULL,
    location        text NOT NULL,
    what_was_planted text NOT NULL,
    requirement     text NOT NULL,
    relevant_idea   text NOT NULL
);
COMMENT ON TABLE seeded_exception IS 'Answer key: every deliberately planted data issue. A detector should find each; anything else is a false positive or a new finding.';

-- =============================================================================
-- Views: the workbook's formula columns and pivots
-- =============================================================================

-- SAP Data: one row per WBS with periods 1-12, YTD TOTAL and 'In Copperleaf?'
CREATE VIEW v_sap_wbs_ytd AS
SELECT w.wbs_element,
       w.project_definition,
       p.project_name,
       w.description           AS wbs_description,
       p.company_code,
       w.object_class,
       p.person_responsible,
       p.initiative_id,
       p.scheme_ref,
       w.activity_code,
       ra.description          AS activity_description,
       fp.fiscal_year,
       sum(a.amount) FILTER (WHERE a.period = 1)  AS p01,
       sum(a.amount) FILTER (WHERE a.period = 2)  AS p02,
       sum(a.amount) FILTER (WHERE a.period = 3)  AS p03,
       sum(a.amount) FILTER (WHERE a.period = 4)  AS p04,
       sum(a.amount) FILTER (WHERE a.period = 5)  AS p05,
       sum(a.amount) FILTER (WHERE a.period = 6)  AS p06,
       sum(a.amount) FILTER (WHERE a.period = 7)  AS p07,
       sum(a.amount) FILTER (WHERE a.period = 8)  AS p08,
       sum(a.amount) FILTER (WHERE a.period = 9)  AS p09,
       sum(a.amount) FILTER (WHERE a.period = 10) AS p10,
       sum(a.amount) FILTER (WHERE a.period = 11) AS p11,
       sum(a.amount) FILTER (WHERE a.period = 12) AS p12,
       coalesce(sum(a.amount), 0)                 AS ytd_total,
       EXISTS (SELECT 1 FROM copperleaf_investment ci
               WHERE ci.sap_project = w.project_definition) AS in_copperleaf
FROM wbs_element w
JOIN sap_project p          USING (project_definition)
JOIN regulatory_activity ra USING (activity_code)
CROSS JOIN (SELECT DISTINCT fiscal_year FROM fiscal_period) fp
LEFT JOIN sap_wbs_actual a  ON a.wbs_element = w.wbs_element AND a.fiscal_year = fp.fiscal_year
GROUP BY w.wbs_element, p.project_definition, ra.activity_code, fp.fiscal_year;
COMMENT ON VIEW v_sap_wbs_ytd IS 'Wide SAP Data layout per fiscal year, incl. YTD TOTAL and In Copperleaf? (replaces the SAPPivot sheet when grouped by project).';

-- Actual Allocation: PO Actual, Calculated Allocation, Final Allocated Actual
CREATE VIEW v_po_allocation AS
SELECT al.allocation_id,
       al.po_number,
       al.project_definition,
       p.project_name,
       al.wbs_element,
       al.wbs_description,
       al.initiative_id,
       po.allocation_basis                                    AS allocation_rule,
       al.allocation_pct,
       po.actual_posted                                       AS po_actual,
       al.allocation_pct * po.actual_posted                   AS calculated_allocation,
       al.manual_adjustment,
       al.allocation_pct * po.actual_posted + al.manual_adjustment AS final_allocated_actual,
       al.allocation_rationale,
       al.review_status,
       (w.wbs_element IS NOT NULL)                            AS wbs_exists_in_sap,
       (al.initiative_id = p.initiative_id)                   AS initiative_matches_project
FROM po_allocation al
JOIN purchase_order po   USING (po_number)
JOIN sap_project p       ON p.project_definition = al.project_definition
LEFT JOIN wbs_element w  ON w.wbs_element = al.wbs_element;
COMMENT ON VIEW v_po_allocation IS 'Actual Allocation sheet with formula columns J, K, M plus integrity flags.';

-- PO Summary: Total Allocation %, Allocated Actual, Unallocated Difference
CREATE VIEW v_purchase_order_summary AS
SELECT po.*,
       coalesce(sum(al.allocation_pct), 0)                    AS total_allocation_pct,
       coalesce(sum(al.final_allocated_actual), 0)            AS allocated_actual,
       po.actual_posted - coalesce(sum(al.final_allocated_actual), 0) AS unallocated_difference
FROM purchase_order po
LEFT JOIN v_po_allocation al USING (po_number)
GROUP BY po.po_number;
COMMENT ON VIEW v_purchase_order_summary IS 'PO Summary sheet incl. formula columns M-O.';

-- CopperPivot: investments by regulatory submission
CREATE VIEW v_copperleaf_by_submission AS
SELECT ci.final_submission_inv_id_t3,
       sum(ci.final_submission_volume_t3) OVER (PARTITION BY ci.final_submission_inv_id_t3) AS submission_volume_t3,
       ci.investment_code,
       ci.investment_name,
       ci.pac_code,
       ci.sap_project,
       ci.percentage_of_wbs,
       ci.idt_total_ecc
FROM copperleaf_investment ci;
COMMENT ON VIEW v_copperleaf_by_submission IS 'CopperPivot sheet: Copperleaf investments by RIIO-T3 submission.';

-- =============================================================================
-- Read-only role for the MCP server (mcp-server/). Defense in depth: SELECT-only
-- grants, read-only transactions and a statement timeout are enforced by the
-- database, not just by the server. The seeded_exception answer key is withheld
-- so an analysis agent has to find the issues itself; grant it to opt in.
-- Set a password for non-local use: ALTER ROLE cg_mcp_readonly PASSWORD '...';
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'cg_mcp_readonly') THEN
        CREATE ROLE cg_mcp_readonly LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
    END IF;
END $$;
ALTER ROLE cg_mcp_readonly SET default_transaction_read_only = on;
ALTER ROLE cg_mcp_readonly SET statement_timeout = '15s';
ALTER ROLE cg_mcp_readonly SET search_path = cost_granularity;
REVOKE CREATE ON SCHEMA public FROM cg_mcp_readonly;
GRANT USAGE  ON SCHEMA cost_granularity TO cg_mcp_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA cost_granularity TO cg_mcp_readonly;
REVOKE SELECT ON seeded_exception FROM cg_mcp_readonly;

COMMIT;
