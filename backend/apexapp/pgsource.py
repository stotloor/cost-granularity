"""Load the insight engine's input from the cost_granularity PostgreSQL schema.

The schema and its loader live in database/ (schema.sql, load_workbook.py). Only
input values are stored there; the workbook's formula columns and pivots are views,
so this module reads those views and returns the same records, keyed by the same
field names, that the engine has always consumed per sheet:

    SAP Data           v_sap_wbs_ytd (one fiscal year)
    SAPPivot           sap_wbs_actual summed per WBS (independent control total)
    Copperleaf Data    copperleaf_investment + site
    CopperPivot        v_copperleaf_by_submission
    PO Summary         v_purchase_order_summary
    Actual Allocation  v_po_allocation

Connection: $DATABASE_URL (default postgresql:///cost_granularity, i.e. libpq
defaults such as PGHOST/PGUSER). Schema: $APEX_PG_SCHEMA. Fiscal year:
$APEX_FISCAL_YEAR, else the latest year that has SAP actuals.
"""
import datetime
import os
from decimal import Decimal

import psycopg
from psycopg import errors
from psycopg.rows import dict_row

DSN = os.environ.get("DATABASE_URL", "postgresql:///cost_granularity")
SCHEMA = os.environ.get("APEX_PG_SCHEMA", "cost_granularity")
FISCAL_YEAR = os.environ.get("APEX_FISCAL_YEAR")


class SourceUnavailable(RuntimeError):
    """The database cannot be reached or holds no loaded data."""


class SchemaMismatch(ValueError):
    """A table, view or column the engine reads is missing from the schema."""


# Logical sheet -> (backing relation, query). Column aliases are the engine's field keys.
QUERIES = {
    "SAP Data": ("v_sap_wbs_ytd", """
        SELECT ytd_total, CASE WHEN in_copperleaf THEN 'Yes' ELSE 'No' END AS in_copperleaf,
               company_code, project_definition AS project, project_name,
               wbs_element AS wbs, wbs_description, object_class, person_responsible,
               initiative_id, scheme_ref, activity_code AS reg_activity,
               activity_description AS reg_activity_description,
               p01 AS p1, p02 AS p2, p03 AS p3, p04 AS p4, p05 AS p5, p06 AS p6,
               p07 AS p7, p08 AS p8, p09 AS p9, p10, p11, p12
        FROM v_sap_wbs_ytd
        WHERE fiscal_year = %(fy)s
        ORDER BY project_definition, wbs_element"""),
    "SAPPivot": ("sap_wbs_actual", """
        SELECT w.project_definition AS project, p.project_name, w.wbs_element AS wbs,
               w.description AS wbs_description, p.initiative_id,
               coalesce(sum(a.amount), 0) AS ytd_total
        FROM wbs_element w
        JOIN sap_project p USING (project_definition)
        LEFT JOIN sap_wbs_actual a ON a.wbs_element = w.wbs_element AND a.fiscal_year = %(fy)s
        GROUP BY w.wbs_element, p.project_definition
        ORDER BY w.project_definition, w.wbs_element"""),
    "Copperleaf Data": ("copperleaf_investment", """
        SELECT ci.investment_code, ci.investment_name, s.area, s.site_name AS facility,
               ci.final_submission_inv_id_t3 AS submission_id,
               ci.final_submission_volume_t3 AS submission_volume, ci.investment_volume,
               ci.inv_id_code, ci.price_base, ci.product, s.site_name AS site, ci.site_id,
               ci.funding_position_t3 AS funding_position, ci.intervention_driver,
               ci.sap_project, ci.percentage_of_wbs AS pct_of_wbs, ci.idt_total_ecc AS ecc,
               ci.pac_code
        FROM copperleaf_investment ci
        JOIN site s USING (site_id)
        ORDER BY ci.investment_code"""),
    "CopperPivot": ("v_copperleaf_by_submission", """
        SELECT final_submission_inv_id_t3 AS submission_id,
               submission_volume_t3 AS submission_volume, investment_code, investment_name,
               pac_code, sap_project, percentage_of_wbs AS pct_of_wbs, idt_total_ecc AS ecc
        FROM v_copperleaf_by_submission
        ORDER BY final_submission_inv_id_t3, investment_code"""),
    "PO Summary": ("v_purchase_order_summary", """
        SELECT po_number, supplier_id, contract_ref, description, po_date, currency,
               posting_level,
               coalesce(summary_project_definition, 'MULTI-PROJECT') AS summary_cost_object,
               po_value, actual_posted, allocation_basis, status, total_allocation_pct,
               allocated_actual, unallocated_difference
        FROM v_purchase_order_summary
        ORDER BY po_number"""),
    "Actual Allocation": ("v_po_allocation", """
        SELECT allocation_id, po_number, project_definition AS project, project_name,
               wbs_element AS wbs, wbs_description, initiative_id AS investment_id,
               allocation_rule, allocation_pct, po_actual, calculated_allocation,
               manual_adjustment, final_allocated_actual AS final_allocated,
               allocation_rationale AS rationale, review_status
        FROM v_po_allocation
        ORDER BY allocation_id"""),
}


def _plain(v):
    """Database values -> the int/float/str values the engine expects."""
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, (datetime.date, datetime.datetime)):
        return v.isoformat()
    if isinstance(v, str):
        return v.strip() or None
    return v


def connect(dsn=None):
    try:
        conn = psycopg.connect(dsn or DSN, row_factory=dict_row, connect_timeout=5)
    except psycopg.OperationalError as e:
        raise SourceUnavailable("Cannot connect to the insights database (set DATABASE_URL): %s" % e) from e
    conn.read_only = True
    # One snapshot for the version check and every query, so a concurrent reload can't mix loads.
    conn.isolation_level = psycopg.IsolationLevel.REPEATABLE_READ
    return conn


def _run(cur, query, params=None):
    try:
        cur.execute(query, params)
    except (errors.UndefinedTable, errors.UndefinedColumn, errors.InvalidSchemaName) as e:
        raise SchemaMismatch("Database schema '%s' does not match what the insight engine reads: %s"
                             % (SCHEMA, str(e).strip())) from e
    return cur.fetchall()


def latest_load(cur):
    """The most recent etl_load row; it changes on every reload, so it is the cache key."""
    rows = _run(cur, "SELECT load_id, source_file, source_sha256, loaded_at FROM etl_load "
                     "ORDER BY load_id DESC LIMIT 1")
    if not rows:
        raise SourceUnavailable("No data loaded into %s yet: run database/load_workbook.py" % SCHEMA)
    return rows[0]


def fiscal_year(cur):
    if FISCAL_YEAR:
        return int(FISCAL_YEAR)
    rows = _run(cur, "SELECT coalesce((SELECT max(fiscal_year) FROM sap_wbs_actual), "
                     "(SELECT max(fiscal_year) FROM fiscal_period)) AS fy")
    return rows[0]["fy"]


def set_schema(cur):
    _run(cur, "SELECT set_config('search_path', %s, true) AS path", (SCHEMA,))


def version(dsn=None):
    """Cheap fingerprint of the loaded data: (load_id, fiscal year)."""
    with connect(dsn) as conn, conn.cursor() as cur:
        set_schema(cur)
        return latest_load(cur)["load_id"], fiscal_year(cur)


def load(dsn=None):
    """Return (data, meta).

    data is {sheet: {"header_row": None, "records": [...]}} in the engine's field keys;
    meta describes the source for the payload's "meta" section.
    """
    with connect(dsn) as conn, conn.cursor() as cur:
        set_schema(cur)
        etl = latest_load(cur)
        fy = fiscal_year(cur)
        data, sheets = {}, []
        for sheet, (relation, query) in QUERIES.items():
            records = [{"_row": None, **{k: _plain(v) for k, v in r.items()}}
                       for r in _run(cur, query, {"fy": fy})]
            data[sheet] = {"header_row": None, "records": records}
            sheets.append({"name": sheet, "table": "%s.%s" % (SCHEMA, relation), "header_row": None,
                           "records": len(records), "columns": len(cur.description)})
        dbname = conn.info.dbname
    meta = {
        "source": "PostgreSQL %s.%s" % (dbname, SCHEMA),
        "modified": etl["loaded_at"].astimezone(datetime.timezone.utc).isoformat(),
        "load_id": etl["load_id"], "source_file": etl["source_file"],
        "source_sha256": etl["source_sha256"].strip(), "fiscal_year": fy,
        "sheets": sheets,
    }
    return data, meta
