# Cost Granularity – PostgreSQL

Loads `Cost_Granularity_Sample_Data_v2.xlsx` into the `cost_granularity` schema of the
`cost_granularity` database.

## Setup

```bash
createdb cost_granularity
psql -d cost_granularity -v ON_ERROR_STOP=1 -f schema.sql      # drops & recreates the schema
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python load_workbook.py ~/Downloads/Cost_Granularity_Sample_Data_v2.xlsx \
    --dsn postgresql://localhost/cost_granularity
```

The loader runs in one transaction and replaces all business data, so it's safe to re-run.
Each run is recorded in `etl_load` (file name, SHA-256, row counts).

## Model

| Sheet | Tables | Views (formula columns) |
|---|---|---|
| SAP Data | `sap_project`, `wbs_element`, `sap_wbs_actual` (unpivoted periods), `regulatory_activity`, `fiscal_period` | `v_sap_wbs_ytd` (periods 1-12, YTD TOTAL, In Copperleaf?) |
| Copperleaf Data | `copperleaf_investment`, `site` | `v_copperleaf_by_submission` (CopperPivot) |
| PO Summary | `purchase_order`, `contract`, `supplier`, `allocation_basis` | `v_purchase_order_summary` (cols M-O) |
| Actual Allocation | `po_allocation` | `v_po_allocation` (cols J, K, M + integrity flags) |
| Seeded Exceptions | `seeded_exception` | |
| Read Me | `COMMENT ON` schema/tables/columns | |

The design rules:

- **Natural keys as PKs, with format CHECKs.** For example: `PO-\d{10}`, `GT-P\d{4}(\.\d{2})+`.
- **FKs on every relationship the data supports, all indexed.**
- **`numeric(15,2)` for money.**
- **Only inputs are stored.** Excel formulas are views, so totals can't drift. The views were checked
  against the workbook's cached formula values with 0 mismatches.
- **Planted data issues are kept, not rejected.** Constraints enforce structure, not the business
  rules those issues break. The one place this forced a soft reference is `po_allocation.wbs_element`:
  issue P3 is allocations to WBS elements that don't exist in SAP, so it has no FK. Use
  `v_po_allocation.wbs_exists_in_sap` to find them.
- **The loader enforces a contract.** Sheet headers must match exactly. It also checks the
  dependencies the schema assumes: per-project SAP attributes, site → area, contract → supplier,
  and allocation project name/rule matching master data. Any violation stops the load.

## Read-only role

`schema.sql` also creates `cg_mcp_readonly`, used by `../mcp-server/`. The role has SELECT-only
grants, read-only transactions and a 15 s statement timeout. It can't see `seeded_exception`, the PoC
answer key.
