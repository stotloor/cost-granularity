# Cost Granularity MCP server

Gives an agent read-only SQL access to the `cost_granularity` Postgres database built by
`../database/`. It exposes the tools an analyst needs to explore the data and find reconciliation issues.

## Tools

| Tool | Purpose |
|---|---|
| `get_business_context` | Domain guide: the three cost grains (PO / SAP / Copperleaf), GBP and the April fiscal calendar, the reconciliation rules the data should satisfy, derived metrics, which views to use. |
| `get_schema` | All queryable tables and views with descriptions, row counts, columns (type, nullability, PK, description), foreign keys, soft references and the last data load. `include_columns=false` gives a compact overview. |
| `run_query` | One read-only PostgreSQL query. Returns `columns`, `rows`, `row_count` and `truncated` (default 200 rows, max 2000). SQL errors come back with the Postgres message, hint and position, so the agent can correct itself. |
| `describe_table` | Detail for one table or view: a profile of every column (nulls, distinct count, min/max, top values), sample rows, and the SQL definition for views. |
| `get_distinct_values` | Distinct values of a column with counts, for statuses, codes, regions and price bases. |
| `search_values` | Finds every table, column and row key that mentions a term, e.g. `GT-P0416`, `Northfield` or `PAC-02000`. |

There is also a prompt, `cost_granularity_analyst`, with a suggested workflow. All tools are annotated `readOnlyHint`.

## Safety

The server connects as `cg_mcp_readonly`, which `../database/schema.sql` creates. The database itself enforces:

- SELECT-only grants
- `default_transaction_read_only = on`
- a 15 s `statement_timeout`

The server adds its own guards on top:

- a read-only transaction per call, always rolled back
- a single-statement check, so `commit; delete ...` can't escape the read-only transaction
- a row cap
- table names validated against what the role can see

`seeded_exception` is the PoC answer key, so it is **not granted** to the MCP role and an agent has to
find the issues itself. To expose it:
`GRANT SELECT ON cost_granularity.seeded_exception TO cg_mcp_readonly;`

## Run

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python server.py                                          # stdio
.venv/bin/python server.py --transport streamable-http --port 8765  # http://127.0.0.1:8765/mcp
.venv/bin/python tests/smoke_test.py                                # end-to-end test over stdio
```

| Env var | Default |
|---|---|
| `CG_DATABASE_URL` | `postgresql://cg_mcp_readonly@localhost/cost_granularity` |
| `CG_STATEMENT_TIMEOUT_MS` | `15000` |

## Clients

- **Claude Code:** `../.mcp.json` registers the server for this project. Approve it on first use.
- **Flowise:** add a *Custom MCP* tool node with one of these configs.
  - Streamable HTTP (start the server with `--transport streamable-http`): `{"url": "http://host.docker.internal:8765/mcp"}`
  - stdio (Flowise on the same machine):
    `{"command": "/abs/path/mcp-server/.venv/bin/python", "args": ["/abs/path/mcp-server/server.py"]}`

  When Flowise runs in Docker, start the server with `--host 0.0.0.0` and use `host.docker.internal`.
