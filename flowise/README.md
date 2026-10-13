# Cost Granularity Insights — Flowise Agentflow

`Cost Granularity Insights Agentflow.json` is an Agentflow V2. Import it via Agentflows → Add New → Load.

```
Start → Fetch Workbook (HTTP) → Extract Sheets to Rows → Data Standardisation Agent
   ├─ Commercial Approval Agent ──┐   pos                              (Purchase Orders)
   ├─ Financial Posting Agent ────┼→  projects, activities, …          (Projects & WBS, Activity Analysis)
   └─ Analytical Reporting Agent ─┘   investments, submissions, …      (Investment Traceability)
        → Reconciliation & Controls Agent   corrections, exceptions, checks, requirements, summary, meta
        → Merge Sections → Apply Corrections → Validate Payload Schema → Payload valid?
             ├ yes → Return Frontend JSON
             └ no  → Payload Repair Agent → Apply Patches → Re-validate (loop, max 2)
```

There are six agents, all on Claude Sonnet (`claude-sonnet-5-5`, temperature 0, 64k output tokens; change
`MODEL` in `build_flow.py`). One agent owns each grain and writes that page's data directly:

- **Commercial approval** — each summary PO with its committed value and posted actual, its allocation
  across projects and WBS elements, and whether that allocation reconciles to SAP.
- **Financial posting** — SAP S/4 actuals by project and WBS element (with the WBS tree), plus the
  regulatory activity, investment attribution and PO allocations on each element.
- **Analytical reporting** — submission → investment → SAP project → WBS → actual (BR-001, BR-003);
  planned cost from Copperleaf, actual is SAP YTD × the investment's % of WBS.

Each grain agent computes the cross-grain fields it shows from the standardised tables. The
Reconciliation & Controls Agent then checks that the three agree and returns any fixes as JSON patches,
which Apply Corrections applies before validation. It also writes exceptions, checks, requirements and
the summary KPIs.

The final output is the same document the backend serves at `GET /api/insights`.

The Custom Function nodes are implemented in `functions/` and contain no business logic:

| Node | File | Does |
|---|---|---|
| Extract Sheets to Rows | `extract_sheets.js` | Unzips the .xlsx (zlib) into `{row, cells}` per sheet, keeping Excel row numbers |
| Merge Sections | `merge_sections.js` | Joins the 4 agents' sections into one payload, dropping keys the agents pass to each other; tolerates markdown fences or prose around the JSON |
| Validate Payload Schema | `validate_payload.js` | Checks shape and types against the frontend schema plus cross-section totals; reports JSON Pointer paths |
| Apply Corrections / Apply Patches | `apply_patches.js` | Applies the reconciliation agent's `corrections`, or the repair agent's patch (input `patch_key`), as RFC 6902; skips and logs bad operations |

They use only modules Flowise's sandbox allows by default (`zlib`, `buffer`, plus `node-fetch` for the
download fallback). Fetch Workbook uses response type **Array Buffer**. From the Flowise source, "Raw (Base64)" passes an
unknown response type to axios, which decodes the bytes as UTF-8 text before they are re-encoded, and that
would corrupt a binary file. Extract also accepts base64, so either works if that changes.

The largest agent output, the financial grain (projects with WBS trees, plus activities), is about 28k tokens.

Test the functions as Flowise runs them (async body, `$`-variables, restricted `require`), against the
real workbook and the backend's own payload:

```bash
node flowise/test_functions.mjs
```

Regenerate after changing prompts or layout:

```bash
python3 build_flow.py "Cost Granularity Insights Agentflow.json"
```

The generator reads its contracts from the repo: the column contract from `backend/apexapp/workbook.py`,
the requirement catalogue from `backend/apexapp/requirements.py`, and the payload shape from
`frontend/src/lib/insightsSnapshot.json`. Re-export that snapshot first if the backend output changes.
`templates/` holds the Flowise marketplace flows whose node definitions are copied.

Before running, set:
- an Anthropic credential on every Agent node
- `HTTP_SECURITY_CHECK=false` on the Flowise server if the workbook URL is on localhost or a private network
