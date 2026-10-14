"""End-to-end test: start server.py over stdio with a real MCP client and call every tool.

    .venv/bin/python tests/smoke_test.py
"""
import asyncio
import json
import sys
import uuid
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

SERVER = Path(__file__).resolve().parent.parent / 'server.py'


def payload(result):
    if result.is_error:
        return {'error': result.content[0].text}
    if result.structured_content is not None:
        sc = result.structured_content
        return sc.get('result', sc) if set(sc) == {'result'} else sc
    text = result.content[0].text
    try:
        return json.loads(text)
    except ValueError:
        return text


async def main():
    failures = []

    def check(name, cond, detail=''):
        print(('PASS ' if cond else 'FAIL ') + name + (f'  [{detail}]' if detail and not cond else ''))
        if not cond:
            failures.append(name)

    params = StdioServerParameters(command=sys.executable, args=[str(SERVER)])
    async with stdio_client(params) as (r, w), ClientSession(r, w) as s:
        await s.initialize()
        tools = {t.name for t in (await s.list_tools()).tools}
        check('tools listed', tools >= {'get_schema', 'run_query', 'describe_table', 'get_distinct_values',
                                        'search_values', 'get_business_context', 'create_chart',
                                        'add_conversation_summary', 'get_recent_conversations'}, tools)
        prompts = {p.name for p in (await s.list_prompts()).prompts}
        check('prompt listed', 'cost_granularity_analyst' in prompts, prompts)

        call = lambda n, **a: s.call_tool(n, a)
        schema = payload(await call('get_schema'))
        names = {x['name'] for x in schema['relations']}
        check('schema has tables and views', {'purchase_order', 'v_po_allocation', 'wbs_element'} <= names, names)
        check('answer key hidden', 'seeded_exception' not in names)
        check('foreign keys present', any(f['from_table'] == 'po_allocation' for f in schema['foreign_keys']))
        check('last load reported', 'last_load' in schema)

        q = payload(await call('run_query', query="SELECT po_number, unallocated_difference FROM v_purchase_order_summary "
                                                  "WHERE unallocated_difference <> 0 ORDER BY 1"))
        check('query works', q.get('row_count', 0) >= 1, q)
        q = payload(await call('run_query', query="select wbs_element from wbs_element where wbs_element like 'GT-P04%'", max_rows=3))
        check('LIKE with % and truncation', q.get('row_count') == 3 and q.get('truncated') is True, q)
        q = payload(await call('run_query', query="select ';' as semi -- trailing; comment\n;"))
        check('semicolon in literal/comment ok', q.get('rows') == [[';']], q)
        for bad in ["DELETE FROM purchase_order", "select 1; delete from purchase_order",
                    "commit; delete from purchase_order", "select * from seeded_exception",
                    "with x as (delete from po_allocation returning 1) select * from x",
                    "select pg_sleep(1) ; select 1", "selec 1"]:
            res = payload(await call('run_query', query=bad))
            check(f'rejected: {bad[:45]}', isinstance(res, dict) and 'error' in res, res)
        e = payload(await call('run_query', query="select po_numbr from purchase_order"))
        check('SQL error message reaches agent', 'po_numbr' in e.get('error', '') and 'does not exist' in e['error'], e)
        e = payload(await call('run_query', query="select * from seeded_exception"))
        check('permission error is explicit', 'permission denied' in e.get('error', ''), e)
        q = payload(await call('run_query', query="select count(*) from purchase_order"))
        check('data intact after attacks', q['rows'] == [[20]], q)

        d = payload(await call('describe_table', table='purchase_order'))
        check('describe_table profile', len(d.get('profile', [])) == len(d.get('columns', [])) > 0, d)
        d = payload(await call('describe_table', table='v_po_allocation', sample_rows=2))
        check('describe view has definition', 'definition' in d and len(d['sample']['rows']) == 2)
        d = payload(await call('describe_table', table='pg_shadow'))
        check('describe rejects unknown', isinstance(d, dict) and 'error' in d, d)

        v = payload(await call('get_distinct_values', table='po_allocation', column='review_status'))
        check('distinct values', {x['value'] for x in v['values']} == {'Approved', 'For review', 'Query raised'}, v)
        v = payload(await call('get_distinct_values', table='po_allocation', column='nope'))
        check('distinct rejects bad column', 'error' in v, v)

        f = payload(await call('search_values', term='GT-P0416'))
        check('search finds project in several tables', len({m['table_name'] for m in f['matches']}) >= 3, f)
        f = payload(await call('search_values', term='100%_x'))
        check('search escapes wildcards', f['matches'] == [], f)

        def spec_of(res):
            md = res.get('markdown', '') if isinstance(res, dict) else ''
            ok = md.startswith('```chart\n') and md.endswith('\n```')
            return json.loads(md[len('```chart\n'):-len('\n```')]) if ok else None

        c = payload(await call('create_chart', chart_type='bar', title='YTD SAP actual by project',
                                query='select project_definition, sum(ytd_total) as ytd from v_sap_wbs_ytd group by 1 order by 2 desc',
                                x='project_definition', y=['ytd'], series_labels=['YTD actual'], unit='gbp'))
        sp = spec_of(c)
        check('chart from query', sp is not None and sp['type'] == 'cg-chart' and len(sp['data']) == 18
              and sp['series'][0]['label'] == 'YTD actual' and sp['unit'] == 'gbp', c)
        c = payload(await call('create_chart', chart_type='pie', title='YTD by regulatory activity',
                                query='select activity_code, sum(ytd_total) as ytd from v_sap_wbs_ytd group by 1',
                                x='activity_code', y=['ytd'], unit='gbp'))
        sp = spec_of(c)
        check('pie folds tail into Other', sp is not None and len(sp['data']) == 6
              and sp['data'][-1]['activity_code'].startswith('Other'), c)
        c = payload(await call('create_chart', chart_type='line', title='Spend by period', x='period', y=['amount'],
                                data=[{'period': 'P1', 'amount': 10.5}, {'period': 'P2', 'amount': '1,200'}]))
        sp = spec_of(c)
        check('chart from inline data', sp is not None and sp['data'][1]['amount'] == 1200, c)
        for bad, args in [
            ('both query and data', dict(chart_type='bar', title='t', x='a', y=['b'], query='select 1 as a, 2 as b', data=[{'a': 1, 'b': 2}])),
            ('neither query nor data', dict(chart_type='bar', title='t', x='a', y=['b'])),
            ('unknown chart type', dict(chart_type='radar', title='t', x='a', y=['b'], data=[{'a': 1, 'b': 2}])),
            ('pie with two series', dict(chart_type='pie', title='t', x='a', y=['b', 'c'], data=[{'a': 'x', 'b': 1, 'c': 2}])),
            ('missing column', dict(chart_type='bar', title='t', x='a', y=['nope'], data=[{'a': 'x', 'b': 1}])),
            ('non-numeric y', dict(chart_type='bar', title='t', x='a', y=['b'], data=[{'a': 'x', 'b': 'lots'}])),
            ('write via query', dict(chart_type='bar', title='t', x='a', y=['b'], query='delete from purchase_order returning 1 as a, 2 as b')),
        ]:
            res = payload(await call('create_chart', **args))
            check(f'chart rejects: {bad}', isinstance(res, dict) and 'error' in res, res)

        user = f'smoke-test-{uuid.uuid4().hex}@example.com'
        h = payload(await call('get_recent_conversations', user_id=user))
        check('no history for new user', h.get('count') == 0 and h.get('conversations') == [], h)
        for i in range(4):
            a = payload(await call('add_conversation_summary', user_id=user, summary=f'summary {i}'))
            check(f'stored summary {i}', a.get('conversation', {}).get('summary') == f'summary {i}', a)
        h = payload(await call('get_recent_conversations', user_id=user.upper()))
        check('3 most recent, newest first, case-insensitive user',
              [c['summary'] for c in h.get('conversations', [])] == ['summary 3', 'summary 2', 'summary 1'], h)
        h = payload(await call('get_recent_conversations', user_id=user, limit=10))
        check('history limit', h.get('count') == 4, h)
        for bad in [dict(user_id=user, summary='  '), dict(user_id='', summary='x')]:
            res = payload(await call('add_conversation_summary', **bad))
            check(f'history rejects: {bad}', isinstance(res, dict) and 'error' in res, res)
        names = {x['name'] for x in payload(await call('get_schema', include_columns=False))['relations']}
        check('history hidden from analysis tools', 'conversation_history' not in names, names)

        ctx = payload(await call('get_business_context'))
        check('business context', isinstance(ctx, str) and 'percentage_of_wbs' in ctx)
        p = await s.get_prompt('cost_granularity_analyst', {'question': 'Which POs are over-allocated?'})
        check('prompt renders', 'over-allocated' in p.messages[0].content.text)

        print(json.dumps({k: schema[k] for k in ('schema', 'last_load')}, default=str))
    print(f'\n{len(failures)} failure(s)')
    sys.exit(1 if failures else 0)


asyncio.run(main())
