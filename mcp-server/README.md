# Cost Granularity MCP server

Gives an agent read-only SQL access to the `cost_granularity` Postgres database built by
`../database/`. It exposes the tools an analyst needs to explore the data and find reconciliation issues,
plus conversation history so the assistant can recall earlier conversations with a user.

## Tools

| Tool | Purpose |
|---|---|
| `get_business_context` | Domain guide: the three cost grains (PO / SAP / Copperleaf), GBP and the April fiscal calendar, the reconciliation rules the data should satisfy, derived metrics, which views to use. |
| `get_schema` | All queryable tables and views with descriptions, row counts, columns (type, nullability, PK, description), foreign keys, soft references and the last data load. `include_columns=false` gives a compact overview. |
| `run_query` | One read-only PostgreSQL query. Returns `columns`, `rows`, `row_count` and `truncated` (default 200 rows, max 2000). SQL errors come back with the Postgres message, hint and position, so the agent can correct itself. |
| `describe_table` | Detail for one table or view: a profile of every column (nulls, distinct count, min/max, top values), sample rows, and the SQL definition for views. |
| `get_distinct_values` | Distinct values of a column with counts, for statuses, codes, regions and price bases. |
| `search_values` | Finds every table, column and row key that mentions a term, e.g. `GT-P0416`, `Northfield` or `PAC-02000`. |
| `create_chart` | Builds a chart from a read-only SQL `query` (preferred, so the values come straight from the database) or from inline `data`. It returns a `cg-chart` spec wrapped in a ```` ```chart ```` markdown block for the agent to paste into its answer. |
| `add_conversation_summary` | Stores a summary of a conversation for a `user_id` (e.g. the login email), timestamped now. |
| `get_recent_conversations` | The most recent summaries for a `user_id`, newest first (default 3, max 20). `user_id` matches case-insensitively. |

There is also a prompt, `cost_granularity_analyst`, with a suggested workflow. Every tool except
`add_conversation_summary` is annotated `readOnlyHint`.

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

## Conversation history

Summaries are stored in `assistant.conversation_history`, created by `../database/conversation_history.sql`.
The table sits in its own schema because `schema.sql` drops `cost_granularity`, and reloading the data
shouldn't wipe the history.

The two history tools connect as `cg_mcp_history`, not `cg_mcp_readonly`. That role can only SELECT and
INSERT that one table, so the history is append-only and the analysis connection stays read-only.
`cg_mcp_readonly` can't see the table, so `get_schema` and `run_query` don't expose it.

The app has no Postgres user table, so `user_id` is whatever stable identifier the client gives the agent.
In this app it's the login email. The backend's `/api/ai/assistant` proxy sets it, so a user can't pick someone
else's ID:

1. The frontend posts `{question, history}` with its login token to `/api/ai/assistant`.
2. The backend looks up the user's email and forwards to Flowise with
   `overrideConfig: {startState: [{key: "userId", value: <email>}], vars: {userId: <email>}}`.
3. The agent reads it in its system prompt as `{{ $flow.state.userId }}` (Agentflow V2) or
   `{{ $vars.userId }}` (chatflow) and passes it to the history tools (see `prompts/conversational_agent.md`).

**Flowise setup:**
- On the Start node, add a Flow State key `userId` with an empty value.
- In the flow's Configuration → Security → Override Configuration, enable override and allow the Start
  node's `startState`. Without this, Flowise silently ignores the value.
- For a chatflow, create a Variable `userId` and allow it to be overridden instead.

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
| `CG_HISTORY_DATABASE_URL` | `postgresql://cg_mcp_history@localhost/cost_granularity` |
| `CG_STATEMENT_TIMEOUT_MS` | `15000` |

## Clients

- **Claude Code:** `../.mcp.json` registers the server for this project. Approve it on first use.
- **Flowise:** add a *Custom MCP* tool node with one of these configs.
  - Streamable HTTP (start the server with `--transport streamable-http`): `{"url": "http://host.docker.internal:8765/mcp"}`
  - stdio (Flowise on the same machine):
    `{"command": "/abs/path/mcp-server/.venv/bin/python", "args": ["/abs/path/mcp-server/server.py"]}`

  When Flowise runs in Docker, start the server with `--host 0.0.0.0` and use `host.docker.internal`.

## Public tunnel (e.g. ngrok)

The HTTP transport rejects unknown `Host` headers with a 421 error, which protects against DNS rebinding.
To serve through a tunnel, allow the tunnel's domain:

```bash
.venv/bin/python server.py --transport streamable-http --port 8765 --allowed-host <your-subdomain>.ngrok-free.dev
ngrok http 8765
```

The server has no authentication, so anyone who has the URL can query the database (read-only).

## Charts

`create_chart` doesn't return an image. It returns a small JSON **chart spec**, already wrapped in a
fenced block:

````
```chart
{"type":"cg-chart","version":1,"chart":"bar","title":"YTD SAP actual by project",
 "x":{"key":"project_definition","label":"Project"},"series":[{"key":"ytd","label":"YTD actual"}],
 "unit":"gbp","data":[{"project_definition":"GT-P0462","ytd":4008190}, ...]}
```
````

The agent pastes that block into its reply as-is. The Flowise endpoint returns plain text, so this
block is the only way the chart can get through, and a spec is small enough to survive: six charts
came to about 5 KB in total. The client then renders it. In this app, the AI Assistant tab draws every
```` ```chart ```` block as an interactive chart (`frontend/src/components/AssistantChart.jsx`).

**Why a spec rather than an image:**
- **No hosting needed:** an image would mean storing a file and passing a URL, or pasting kilobytes
  of base64 that the model can't copy reliably.
- **Interactive:** the chart gets tooltips and a data table.
- **Consistent styling:** the client styles every chart the same way.
- **Accurate numbers:** with `query`, the values come from the database, not from the model retyping
  them.

**Chart types:** `bar`, `horizontal_bar`, `line`, `area` (optionally `stacked`), `pie` (6 slices at
most, with the rest folded into "Other") and `scatter` (3 series at most).

**Units:** `gbp`, `percent` or `number`. Every chart has one unit and one y-axis, so £ and % never
share a chart.

**Limits:**
- 500 rows; aggregate in SQL to stay under it
- 60 bar categories
- 8 series
- 24 KB per spec

**Errors:** the tool rejects bad input with a message the agent can act on.

**Flowise setup:** in the agent's MCP tool node, refresh **Available Actions** and enable
`create_chart`. The node only exposes the tools selected there. Then add the *Charts* section of
`prompts/conversational_agent.md` to the agent's system prompt.
