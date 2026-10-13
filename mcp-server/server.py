"""MCP server exposing the cost_granularity Postgres schema to analysis agents.

    python server.py                                   # stdio (Claude Code, Claude Desktop, Flowise stdio)
    python server.py --transport streamable-http --port 8765   # HTTP at /mcp (Flowise, remote clients)

Connects with $CG_DATABASE_URL (default: postgresql://cg_mcp_readonly@localhost/cost_granularity).
Use the cg_mcp_readonly role created by database/schema.sql: it can only SELECT, its
transactions are read-only and its statements time out. The server adds its own
guards (single statement, read-only transaction, row cap) on top.
"""
from __future__ import annotations

import argparse
import datetime as dt
import os
import re
from decimal import Decimal
from typing import Any
from uuid import UUID

import psycopg
from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from mcp.server.transport_security import TransportSecuritySettings
from mcp.types import ToolAnnotations
from psycopg import sql

import charts

DSN = os.environ.get('CG_DATABASE_URL', 'postgresql://cg_mcp_readonly@localhost/cost_granularity')
SCHEMA = 'cost_granularity'
STATEMENT_TIMEOUT_MS = int(os.environ.get('CG_STATEMENT_TIMEOUT_MS', '15000'))
MAX_ROWS_CAP = 2000
READ_ONLY = ToolAnnotations(read_only_hint=True, destructive_hint=False, idempotent_hint=True,
                            open_world_hint=False)

mcp = MCPServer(
    'cost-granularity',
    instructions=(
        'Read-only access to the Cost Granularity database: SAP S/4 project/WBS actuals, Copperleaf '
        'planned investments, summary purchase orders and their manual allocation to projects/WBS. '
        'Start with get_business_context and get_schema, use describe_table / get_distinct_values / '
        'search_values to learn the data, then answer with run_query (PostgreSQL SELECT). '
        'Prefer the v_* views: they already compute YTD totals, allocated amounts and reconciliation flags. '
        'To show a chart, call create_chart and paste its `markdown` block verbatim into your answer.'
    ),
)


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

class QueryError(ToolError):
    """An error whose message is returned to the agent (bad SQL, unknown table, ...)."""


def _connect() -> psycopg.Connection:
    conn = psycopg.connect(DSN, autocommit=False, connect_timeout=10)
    with conn.cursor() as cur:
        cur.execute('SET TRANSACTION READ ONLY')
        cur.execute(sql.SQL('SET LOCAL statement_timeout = {}').format(sql.Literal(STATEMENT_TIMEOUT_MS)))
        cur.execute(sql.SQL('SET LOCAL search_path = {}').format(sql.Identifier(SCHEMA)))
    return conn


def _jsonable(v: Any) -> Any:
    if isinstance(v, Decimal):
        return int(v) if v == v.to_integral_value() and v.as_tuple().exponent >= 0 else float(v)
    if isinstance(v, (dt.date, dt.datetime, dt.time)):
        return v.isoformat()
    if isinstance(v, (UUID, dt.timedelta)):
        return str(v)
    if isinstance(v, (list, tuple)):
        return [_jsonable(x) for x in v]
    return v


def _fetch(query: str | sql.Composable, params: tuple | dict | None = None,
           max_rows: int | None = None) -> tuple[list[str], list[list[Any]], bool]:
    with _connect() as conn, conn.cursor() as cur:
        try:
            cur.execute(query, params)
        except psycopg.Error as e:
            raise QueryError(_pg_error(e)) from None
        if cur.description is None:
            return [], [], False
        cols = [d.name for d in cur.description]
        rows = cur.fetchmany(max_rows + 1) if max_rows else cur.fetchall()
        truncated = bool(max_rows) and len(rows) > max_rows
        conn.rollback()  # never commit anything
        return cols, [[_jsonable(v) for v in r] for r in rows[:max_rows]], truncated


def _pg_error(e: psycopg.Error) -> str:
    diag = e.diag
    msg = (diag.message_primary or str(e)).strip()
    for label, part in (('detail', diag.message_detail), ('hint', diag.message_hint)):
        if part:
            msg += f' ({label}: {part})'
    if diag.statement_position:
        msg += f' [at character {diag.statement_position}]'
    return msg


def _visible_relations() -> dict[str, str]:
    """Tables/views the connected role may SELECT, mapped to 'table' or 'view'."""
    _, rows, _ = _fetch(
        """SELECT c.relname, CASE c.relkind WHEN 'v' THEN 'view' WHEN 'm' THEN 'view' ELSE 'table' END
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = %s AND c.relkind IN ('r', 'p', 'v', 'm')
             AND has_table_privilege(c.oid, 'SELECT')
           ORDER BY 2, 1""", (SCHEMA,))
    return {name: kind for name, kind in rows}


def _check_relation(name: str) -> str:
    rels = _visible_relations()
    if name not in rels:
        raise QueryError(f'unknown table or view {name!r}; available: {", ".join(rels)}')
    return rels[name]


def _columns(table: str) -> list[dict[str, Any]]:
    _, rows, _ = _fetch(
        """SELECT a.attname, format_type(a.atttypid, a.atttypmod), NOT a.attnotnull,
                  col_description(a.attrelid, a.attnum),
                  EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = a.attrelid AND i.indisprimary
                          AND a.attnum = ANY (i.indkey)),
                  a.attgenerated <> ''
           FROM pg_attribute a
           WHERE a.attrelid = format('%%I.%%I', %s::text, %s::text)::regclass
             AND a.attnum > 0 AND NOT a.attisdropped
           ORDER BY a.attnum""", (SCHEMA, table))
    return [{'name': n, 'type': t, 'nullable': nl, 'primary_key': pk,
             **({'generated': True} if gen else {}), **({'description': d} if d else {})}
            for n, t, nl, d, pk, gen in rows]


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

@mcp.tool(annotations=READ_ONLY)
def get_schema(include_columns: bool = True) -> dict:
    """Return the database schema: every table and view you can query, with descriptions,
    row counts, columns (type, nullability, primary key, description), foreign keys
    (join paths), documented soft references and the latest data load.

    Call this first. Set include_columns=False for a compact overview."""
    rels = _visible_relations()
    _, desc_rows, _ = _fetch(
        """SELECT c.relname, obj_description(c.oid, 'pg_class')
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = %s""",
        (SCHEMA,))
    descs = {r[0]: r[1] for r in desc_rows}

    _, fk_rows, _ = _fetch(
        """SELECT tc.relname, con.conname,
                  (SELECT array_agg(a.attname ORDER BY k.ord) FROM unnest(con.conkey) WITH ORDINALITY k(n, ord)
                     JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.n),
                  rc.relname,
                  (SELECT array_agg(a.attname ORDER BY k.ord) FROM unnest(con.confkey) WITH ORDINALITY k(n, ord)
                     JOIN pg_attribute a ON a.attrelid = con.confrelid AND a.attnum = k.n)
           FROM pg_constraint con
           JOIN pg_class tc ON tc.oid = con.conrelid
           JOIN pg_class rc ON rc.oid = con.confrelid
           JOIN pg_namespace n ON n.oid = tc.relnamespace
           WHERE con.contype = 'f' AND n.nspname = %s ORDER BY 1, 2""", (SCHEMA,))
    foreign_keys = [{'from_table': t, 'from_columns': fc, 'to_table': rt, 'to_columns': tc}
                    for t, _, fc, rt, tc in fk_rows if t in rels and rt in rels]

    relations = []
    for name, kind in rels.items():
        _, count_rows, _ = _fetch(sql.SQL('SELECT count(*) FROM {}').format(sql.Identifier(name)))
        entry: dict[str, Any] = {'name': name, 'kind': kind, 'row_count': count_rows[0][0]}
        if descs.get(name):
            entry['description'] = descs[name]
        if include_columns:
            entry['columns'] = _columns(name)
        relations.append(entry)

    _, schema_desc, _ = _fetch("SELECT obj_description(%s::regnamespace, 'pg_namespace')", (SCHEMA,))
    out: dict[str, Any] = {
        'database': 'PostgreSQL', 'schema': SCHEMA, 'description': schema_desc[0][0],
        'relations': relations, 'foreign_keys': foreign_keys,
        'soft_references': [{
            'from': 'po_allocation.wbs_element', 'to': 'wbs_element.wbs_element',
            'note': 'Not enforced: an allocation can name a WBS element that does not exist in SAP. '
                    'LEFT JOIN, or use v_po_allocation.wbs_exists_in_sap.'}],
    }
    if 'etl_load' in rels:
        _, last, _ = _fetch('SELECT source_file, loaded_at FROM etl_load ORDER BY load_id DESC LIMIT 1')
        if last:
            out['last_load'] = {'source_file': last[0][0], 'loaded_at': last[0][1]}
    return out


@mcp.tool(annotations=READ_ONLY)
def run_query(query: str, max_rows: int = 200) -> dict:
    """Run one read-only PostgreSQL query (SELECT / WITH / VALUES / TABLE / EXPLAIN) against
    the cost_granularity schema and return columns and rows.

    - Unqualified names resolve to cost_granularity; one statement per call; no writes.
    - max_rows caps returned rows (default 200, max 2000); 'truncated' tells you if more
      exist, so aggregate in SQL or add LIMIT/OFFSET instead of pulling raw rows.
    - Money is GBP; numeric values come back as JSON numbers.
    - On error you get the PostgreSQL message (with hint and position) to fix the query."""
    max_rows = max(1, min(int(max_rows), MAX_ROWS_CAP))
    stmt = _single_statement(query)
    cols, rows, truncated = _fetch(stmt, max_rows=max_rows)
    return {'columns': cols, 'rows': rows, 'row_count': len(rows), 'truncated': truncated}


_ALLOWED_START = re.compile(r'^\s*(\(\s*)*(select|with|values|table|explain)\b', re.I)


def _single_statement(query: str) -> str:
    stmt = _strip_comments(query).strip().rstrip(';').strip()
    if not stmt:
        raise QueryError('empty query')
    if ';' in _mask_literals(stmt):
        raise QueryError('only one statement per call is allowed')
    if not _ALLOWED_START.match(stmt):
        raise QueryError('only read-only queries are allowed (SELECT, WITH, VALUES, TABLE, EXPLAIN)')
    return query.strip().rstrip(';')


def _strip_comments(q: str) -> str:
    q = re.sub(r'/\*.*?\*/', ' ', q, flags=re.S)
    return re.sub(r'--[^\n]*', ' ', q)


def _mask_literals(q: str) -> str:
    """Blank out string literals and quoted identifiers so ';' inside them is ignored."""
    q = re.sub(r"\$(\w*)\$.*?\$\1\$", "''", q, flags=re.S)
    q = re.sub(r"'(?:[^']|'')*'", "''", q)
    return re.sub(r'"(?:[^"]|"")*"', '""', q)


@mcp.tool(annotations=READ_ONLY)
def describe_table(table: str, sample_rows: int = 5) -> dict:
    """Describe one table or view in depth: description, columns, a profile of every column
    (null count, distinct count, min/max, most common values) and sample rows.
    Use it to understand value ranges, codes and data quality before writing queries."""
    kind = _check_relation(table)
    cols = _columns(table)
    t = sql.Identifier(table)
    _, total, _ = _fetch(sql.SQL('SELECT count(*) FROM {}').format(t))
    total = total[0][0]

    profile = []
    for c in cols:
        ci = sql.Identifier(c['name'])
        comparable = not any(x in c['type'] for x in ('json', 'boolean', '[]'))
        q = sql.SQL('SELECT count(*) FILTER (WHERE {c} IS NULL), count(DISTINCT {c}){mm} FROM {t}').format(
            c=ci, t=t,
            mm=sql.SQL(', min({c}), max({c})').format(c=ci) if comparable else sql.SQL(', NULL, NULL'))
        _, r, _ = _fetch(q)
        nulls, distinct, mn, mx = r[0]
        p: dict[str, Any] = {'column': c['name'], 'nulls': nulls, 'distinct': distinct}
        if mn is not None:
            p['min'], p['max'] = mn, mx
        if 0 < distinct <= 25 or ('numeric' not in c['type'] and 'date' not in c['type']
                                  and distinct < total):
            _, top, _ = _fetch(sql.SQL(
                'SELECT {c}, count(*) FROM {t} WHERE {c} IS NOT NULL GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 5'
            ).format(c=ci, t=t))
            p['top_values'] = [{'value': v, 'count': n} for v, n in top]
        profile.append(p)

    sample_rows = max(0, min(int(sample_rows), 50))
    scols, srows, _ = _fetch(sql.SQL('SELECT * FROM {} LIMIT %s').format(t), (sample_rows,))
    _, d, _ = _fetch("SELECT obj_description(format('%%I.%%I', %s::text, %s::text)::regclass, 'pg_class')",
                     (SCHEMA, table))
    out: dict[str, Any] = {'name': table, 'kind': kind, 'row_count': total}
    if d[0][0]:
        out['description'] = d[0][0]
    if kind == 'view':
        _, vd, _ = _fetch("SELECT pg_get_viewdef(format('%%I.%%I', %s::text, %s::text)::regclass, true)",
                          (SCHEMA, table))
        out['definition'] = vd[0][0]
    out.update(columns=cols, profile=profile, sample={'columns': scols, 'rows': srows})
    return out


@mcp.tool(annotations=READ_ONLY)
def get_distinct_values(table: str, column: str, limit: int = 100) -> dict:
    """List the distinct values of one column with their row counts (most frequent first).
    Use it to discover codes and categories (statuses, activity codes, regions, price bases)
    before filtering on them. NULL is reported as a value."""
    _check_relation(table)
    if column not in {c['name'] for c in _columns(table)}:
        raise QueryError(f'{table} has no column {column!r}')
    limit = max(1, min(int(limit), 1000))
    c, t = sql.Identifier(column), sql.Identifier(table)
    _, rows, truncated = _fetch(
        sql.SQL('SELECT {c}, count(*) FROM {t} GROUP BY 1 ORDER BY 2 DESC, 1 NULLS FIRST').format(c=c, t=t),
        max_rows=limit)
    return {'table': table, 'column': column, 'values': [{'value': v, 'count': n} for v, n in rows],
            'truncated': truncated}


@mcp.tool(annotations=READ_ONLY)
def search_values(term: str, limit: int = 50) -> dict:
    """Find where a value occurs: case-insensitive substring search of every text column in
    every base table. Use it to resolve an identifier or name (e.g. 'GT-P0416', 'PO-4500012152',
    'Northfield', 'PAC-02000') to the tables, columns and keys that mention it."""
    term = term.strip()
    if len(term) < 2:
        raise QueryError('search term must be at least 2 characters')
    rels = [n for n, k in _visible_relations().items() if k == 'table']
    _, rows, _ = _fetch(
        """SELECT c.table_name, c.column_name,
                  (SELECT array_agg(k.column_name ORDER BY k.ordinal_position)
                   FROM information_schema.table_constraints tc
                   JOIN information_schema.key_column_usage k USING (constraint_schema, constraint_name)
                   WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = c.table_schema
                     AND tc.table_name = c.table_name)
           FROM information_schema.columns c
           WHERE c.table_schema = %s AND c.data_type IN ('text', 'character varying', 'character')
           ORDER BY c.table_name, c.ordinal_position""", (SCHEMA,))
    parts = []
    for table, column, pk in rows:
        if table not in rels:
            continue
        key = sql.SQL(" || ' | ' || ").join(
            [sql.SQL('{}::text').format(sql.Identifier(k)) for k in (pk or [column])])
        parts.append(sql.SQL(
            'SELECT {tn} AS table_name, {cn} AS column_name, {key} AS row_key, {c}::text AS value '
            'FROM {t} WHERE {c}::text ILIKE %(p)s').format(
                tn=sql.Literal(table), cn=sql.Literal(column), key=key,
                c=sql.Identifier(column), t=sql.Identifier(table)))
    if not parts:
        return {'term': term, 'matches': [], 'truncated': False}
    pattern = '%' + term.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%'
    limit = max(1, min(int(limit), 500))
    cols, matches, truncated = _fetch(sql.SQL(' UNION ALL ').join(parts) + sql.SQL(' ORDER BY 1, 2, 3'),
                                      {'p': pattern}, max_rows=limit)
    return {'term': term, 'matches': [dict(zip(cols, m)) for m in matches], 'truncated': truncated}


@mcp.tool(annotations=READ_ONLY)
def create_chart(chart_type: str, title: str, x: str, y: list[str],
                 query: str | None = None, data: list[dict[str, Any]] | None = None,
                 series_labels: list[str] | None = None, x_label: str | None = None,
                 unit: str = 'number', stacked: bool = False, subtitle: str | None = None) -> dict:
    """Create a chart for your answer. Returns a chart spec and a `markdown` block.

    HOW TO SHOW IT: copy the returned `markdown` value into your final answer exactly as
    returned (a ```chart fenced block), on its own lines, where the chart should appear.
    Never edit, reformat, summarise or re-type it; the user's app renders it as a chart.
    Still state the key numbers in text: the chart supports the answer, it is not the answer.

    Data (give exactly one):
    - query: a read-only SELECT (same rules as run_query). Preferred: the chart then shows
      database values, not re-typed ones. Aggregate in SQL; one row per x value.
    - data: a list of row objects, only for values you already computed.

    Parameters:
    - chart_type: bar (compare categories) | horizontal_bar (long category names or
      ranked lists) | line (change over periods) | area (cumulative/stacked change over
      periods) | pie (part of a whole, <= 6 slices; the rest is folded into "Other") |
      scatter (relationship between two numeric columns; <= 3 series)
    - x: column for categories/periods (numeric for scatter). y: 1-8 numeric columns,
      all in the same unit. Never put £ and % on one chart; make two charts.
    - unit: gbp | percent (values already 0-100) | number.
    - title: what is plotted and the period, e.g. "YTD SAP actual by project, FY26/27 P1-P6".
    - series_labels: readable names for the y columns; stacked: stack bar/area series.
    """
    if (query is None) == (data is None):
        raise QueryError('give exactly one of query or data')
    if query is not None:
        cols, rows, truncated = _fetch(_single_statement(query), max_rows=charts.MAX_POINTS)
        if truncated:
            raise QueryError(f'the query returns more than {charts.MAX_POINTS} rows; aggregate it first')
    else:
        if not isinstance(data, list) or not all(isinstance(r, dict) for r in data):
            raise QueryError('data must be a list of objects, e.g. [{"project": "GT-P0280", "ytd": 1200}]')
        cols = list(dict.fromkeys(k for r in data for k in r))
        rows = [[r.get(c) for c in cols] for r in data]
    try:
        spec = charts.build_chart(chart_type, title, cols, rows, x, list(y), series_labels,
                                  x_label, unit, stacked, subtitle)
    except charts.ChartError as e:
        raise QueryError(str(e)) from None
    return {'markdown': charts.to_markdown(spec), 'chart': spec['chart'], 'points': len(spec['data']),
            'instructions': 'Paste `markdown` verbatim into your final answer where the chart should appear.'}


BUSINESS_CONTEXT = """\
# Cost Granularity - business context

Synthetic proof-of-concept data for a UK gas transmission operator. Asset-health investments are
planned in Copperleaf (RIIO-T3 regulatory submission) and delivered as SAP S/4 projects and WBS
elements. Contractors are paid through purchase orders that are often raised ABOVE WBS level and
then split manually across projects/WBS.

## Three grains of the same money
1. Commercial (procurement): purchase_order -> po_allocation. A PO's actual_posted is split by
   allocation_pct (fraction 0-1) plus an optional manual_adjustment (GBP) into allocated amounts.
2. Posting (SAP): sap_project -> wbs_element -> sap_wbs_actual (GBP by fiscal period).
3. Analytical (Copperleaf): copperleaf_investment links to one sap_project with
   percentage_of_wbs (0-100) = the investment's share of that project's cost; grouped by the
   regulatory submission final_submission_inv_id_t3.

## Units and time
- All money is GBP. Fiscal year starts 1 April; fiscal_year 2026 = FY 2026/27.
  Period 1 = April ... period 12 = March. Actuals exist for periods 1-6 (Apr-Sep 2026).
- A missing period row means no posting, not zero.
- Copperleaf costs (idt_total_ecc) are estimates in the price_base shown (target basis '23/24').

## Expected relationships (deviations are findings worth reporting)
- SAP WBS actual = internal costs + PO allocations to that WBS. Allocated PO actual to a WBS
  should not exceed that WBS's SAP actual, and should land on a WBS that exists in SAP.
- Per PO: allocation_pct sums to 1 and allocated actual equals actual_posted
  (v_purchase_order_summary.unallocated_difference = 0). actual_posted should not exceed po_value.
  A PO with zero actual has nothing to allocate.
- Manual adjustments should be explained (allocation_rationale) and should net to zero within a PO.
- The initiative_id on an allocation should match the project's initiative_id.
- Per SAP project: percentage_of_wbs across its Copperleaf investments sums to 100.
- Every SAP project with spend should map to a Copperleaf investment and vice versa.
- sap_project.scheme_ref should equal the linked investments' pac_code; it must be a real PAC code.
- WBS costs should sit on a real regulatory activity (regulatory_activity.is_placeholder = false)
  and not on risk/contingency WBS elements.
- Copperleaf investments need an intervention driver, a non-zero volume and the current price base.
- Negative postings can be legitimate: an accrual reversed in the next period, or a credit note.
  Explain them rather than flagging them as errors by default.

## Useful derived figures
- Investment actual attributable = project YTD (sum of v_sap_wbs_ytd.ytd_total for the project)
  x percentage_of_wbs / 100. Compare with idt_total_ecc for burn rate.
- PO burn = actual_posted / po_value. Allocation coverage = total_allocation_pct.

## Views (prefer these)
- v_sap_wbs_ytd: one row per WBS and fiscal year with p01..p12, ytd_total, in_copperleaf.
- v_po_allocation: allocation lines with po_actual, calculated_allocation, final_allocated_actual,
  wbs_exists_in_sap, initiative_matches_project.
- v_purchase_order_summary: POs with total_allocation_pct, allocated_actual, unallocated_difference.
- v_copperleaf_by_submission: investments grouped by regulatory submission.
"""


@mcp.tool(annotations=READ_ONLY)
def get_business_context() -> str:
    """Return the domain guide for this data: what the three cost grains are (PO commercial,
    SAP posting, Copperleaf analytical), units and fiscal calendar, the reconciliation rules the
    data is expected to satisfy (deviations are insights), useful derived metrics and which views
    to use. Read this before analysing."""
    return BUSINESS_CONTEXT


@mcp.prompt()
def cost_granularity_analyst(question: str = 'Find the most important cost-granularity issues and insights.') -> str:
    """Analyst workflow for answering a question about the cost granularity data."""
    return (
        'You are a project-controls analyst with read-only SQL access to the cost_granularity database.\n'
        '1. Call get_business_context, then get_schema (include_columns=false is enough at first).\n'
        '2. Use describe_table / get_distinct_values / search_values to learn the codes and values you need.\n'
        '3. Answer with run_query. Aggregate in SQL; check each reconciliation rule from the business '
        'context explicitly and quantify every finding in GBP with the affected keys (PO, allocation, '
        'project, WBS, investment).\n'
        '4. Distinguish errors from legitimate patterns (e.g. accrual reversals), and say which query '
        'supports each claim.\n\n'
        f'Question: {question}'
    )


def main():
    ap = argparse.ArgumentParser(description='Cost Granularity MCP server')
    ap.add_argument('--transport', choices=['stdio', 'streamable-http', 'sse'], default='stdio')
    ap.add_argument('--host', default='127.0.0.1')
    ap.add_argument('--port', type=int, default=8765)
    ap.add_argument('--allowed-host', action='append', default=[], metavar='HOST',
                    help='Extra Host header to accept, e.g. a tunnel domain (repeatable). '
                         'Localhost is always allowed; DNS-rebinding protection stays on.')
    args = ap.parse_args()
    if args.transport == 'stdio':
        mcp.run()
        return
    kwargs = {}
    if args.allowed_host:
        local = ['127.0.0.1', 'localhost', '[::1]']
        kwargs['transport_security'] = TransportSecuritySettings(
            enable_dns_rebinding_protection=True,
            allowed_hosts=[f'{h}:*' for h in local] + [x for h in args.allowed_host for x in (h, f'{h}:*')],
            allowed_origins=[f'http://{h}:*' for h in local] + [f'https://{h}' for h in args.allowed_host],
        )
    mcp.run(transport=args.transport, host=args.host, port=args.port, **kwargs)


if __name__ == '__main__':
    main()
