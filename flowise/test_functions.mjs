// Runs the flow's Custom Function nodes the way Flowise does (async body, $-variables, restricted
// require), using the code embedded in the exported flow JSON:
//   node flowise/test_functions.mjs
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);
const flow = JSON.parse(readFileSync(path.join(here, 'Cost Granularity Insights Agentflow.json'), 'utf8'));
const snapshot = JSON.parse(readFileSync(path.join(root, 'frontend/src/lib/insightsSnapshot.json'), 'utf8'));
const xlsx = readFileSync(path.join(root, 'Cost Granularity Anonymised with PO Allocation.xlsx'));

const nodeRequire = createRequire(import.meta.url);
const ALLOWED = new Set(['assert', 'buffer', 'crypto', 'events', 'path', 'querystring', 'timers', 'url', 'zlib']); // Flowise defaultAllowBuiltInDep
const sandboxRequire = (m) => {
  if (m === 'node-fetch') return async () => { throw new Error('network disabled in test'); };
  if (!ALLOWED.has(m)) throw new Error(`Cannot find module '${m}' (not allowed in the Flowise sandbox)`);
  return nodeRequire(m);
};
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const code = (label) => {
  const n = flow.nodes.find((x) => x.data.label === label);
  assert.ok(n, 'node ' + label);
  return n.data.inputs.customFunctionJavascriptFunction;
};
async function run(label, vars, state = {}) {
  const names = Object.keys(vars).map((k) => '$' + k);
  // fs / process / child_process are undefined in Flowise's sandbox; shadow them here too.
  const fn = new AsyncFunction('$flow', 'require', 'fs', 'process', 'child_process', ...names, code(label));
  const out = await fn({ state }, sandboxRequire, undefined, undefined, undefined, ...Object.values(vars));
  assert.equal(typeof out, 'string', label + ' must return a string');
  return out;
}

let passed = 0;
const ok = (msg) => { passed += 1; console.log('  ✓ ' + msg); };

// ---------------------------------------------------------------- Extract Sheets to Rows
console.log('Extract Sheets to Rows');
const bufferJson = JSON.stringify(xlsx); // how Flowise passes an arraybuffer HTTP response: {"type":"Buffer","data":[...]}
const raw = JSON.parse(await run('Extract Sheets to Rows', { workbook_file: bufferJson, workbook_url: 'https://example.com/Cost%20Granularity.xlsx' }));
const names = Object.keys(raw.sheets);
assert.deepEqual(names, ['SAP Data', 'SAPPivot', 'Copperleaf Data', 'CopperPivot', 'PO Summary', 'Actual Allocation']);
ok('reads all 6 sheets from a Buffer-JSON input');
const sap = raw.sheets['SAP Data'];
assert.equal(sap[0].row, 2); // row 1 is empty in the workbook
assert.equal(sap[0].cells[1], 'YTD TOTAL');
assert.equal(sap[0].cells[24], '1PROJECT 0001');
assert.equal(sap.length, 68);
assert.equal(sap[2].cells[1], 77127.05);
ok('SAP Data header, row count (1 + 67) and a cached value match the workbook');
const po = raw.sheets['PO Summary'];
assert.equal(po[2].row, 4); // title, subtitle, blank row 3, header row 4
assert.equal(po[2].cells[0], 'PO Number');
assert.equal(po[3].cells[4], 46127);
ok('PO Summary keeps real Excel row numbers across the blank row (header on row 4) and the serial date');
const cl = raw.sheets['Copperleaf Data'];
assert.equal(cl.find((r) => r.cells[0] === 'INITIATIVE 00372').cells[16], '4.221PROJECT 0001493458E7');
ok('corrupted ECC text is passed through untouched for the standardisation agent');
const fromB64 = await run('Extract Sheets to Rows', { workbook_file: xlsx.toString('base64'), workbook_url: '' });
assert.deepEqual(JSON.parse(fromB64).sheets, raw.sheets);
ok('base64 input gives identical rows');
await assert.rejects(run('Extract Sheets to Rows', { workbook_file: 'not a workbook', workbook_url: '' }), /not a valid \.xlsx/);
ok('non-xlsx input raises a clear error');

// ---------------------------------------------------------------- Merge Sections
console.log('Merge Sections');
const GRAIN_STATE = {
  grain_commercial: ['pos'],
  grain_financial: ['projects', 'activities', 'activity_mapping', 'reg_activities'],
  grain_analytical: ['investments', 'submissions', 'investment_breakdowns'],
  reconciliation: ['meta', 'summary', 'exceptions', 'checks', 'requirements'],
};
const sorted = [...snapshot.projects].sort((a, b) => a.project.localeCompare(b.project));
const pick = (keys) => Object.fromEntries(keys.map((k) => [k, snapshot[k]]));
const state = {};
for (const [k, keys] of Object.entries(GRAIN_STATE)) state[k] = JSON.stringify(pick(keys));
// extra keys the agents return for each other are not part of the payload
state.grain_commercial = JSON.stringify({ ...pick(['pos']), checks: [], alloc_by_wbs: { X: 1 } });
state.grain_financial = 'Here are the sections:\n```json\n' + JSON.stringify({ ...pick(GRAIN_STATE.grain_financial), projects: [...sorted].reverse(), sap_total: 1 }) + '\n```';
state.reconciliation = JSON.stringify({ corrections: [], ...pick(GRAIN_STATE.reconciliation) });
const merged = JSON.parse(await run('Merge Sections', {}, state));
assert.deepEqual(Object.keys(merged), Object.keys(snapshot));
assert.deepEqual(merged.projects, sorted);
assert.deepEqual({ ...merged, projects: null }, { ...snapshot, projects: null });
ok('rebuilds the backend payload exactly from the 3 grain agents + reconciliation (prose + ```json fence, extra keys, unsorted projects)');
const broken = JSON.parse(await run('Merge Sections', {}, { ...state, grain_commercial: 'Sorry, I could not do that.' }));
assert.ok(!('pos' in broken) && broken.meta.merge_warnings.some((w) => w.startsWith('grain_commercial')));
ok('an unparseable section is reported in meta.merge_warnings, not silently dropped');

// ---------------------------------------------------------------- Validate Payload Schema
console.log('Validate Payload Schema');
const validate = async (payload) => JSON.parse(await run('Validate Payload Schema', {}, { payload: JSON.stringify(payload) }));
let v = await validate(merged);
assert.equal(v.valid, true, JSON.stringify(v.problems.slice(0, 5)));
ok('the backend\'s own GET /api/insights payload validates with 0 problems');
const bad = JSON.parse(JSON.stringify(merged));
delete bad.pos[1].po_value;
bad.pos[2].remaining_commitment = 1;
bad.projects[0].ytd = 'lots';
bad.summary.sap_ytd += 5000;
bad.summary.exceptions_by_severity.high += 1;
delete bad.requirements;
v = await validate(bad);
const paths = v.problems.map((p) => p.path);
for (const expected of ['/pos/1/po_value', '/pos/2/remaining_commitment', '/projects/0/ytd', '/summary/sap_ytd', '/summary/exceptions_by_severity/high', '/requirements']) {
  assert.ok(paths.includes(expected), 'expected a problem at ' + expected + ' in ' + JSON.stringify(paths));
}
assert.equal(v.valid, false);
ok('detects missing field, wrong type, broken PO arithmetic, KPI drift, count drift and a missing section (' + v.problem_count + ' problems)');
v = await validate(broken);
assert.ok(v.problems.some((p) => p.path === '/pos'));
ok('missing sections after a failed merge are reported');
assert.equal((await validate('{"oops"')).valid, false);
v = JSON.parse(await run('Validate Payload Schema', {}, { payload: 'not json' }));
assert.equal(v.valid, false);
ok('non-JSON payload is invalid, not a crash');

// ---------------------------------------------------------------- Apply Patches
console.log('Apply Patches');
const fix = JSON.parse(JSON.stringify(merged));
delete fix.pos[1].po_value;
fix.pos[2].remaining_commitment = 1;
fix.summary.sap_ytd += 5000;
const patches = [
  { op: 'add', path: '/pos/1/po_value', value: merged.pos[1].po_value },
  { op: 'replace', path: '/pos/2/remaining_commitment', value: merged.pos[2].remaining_commitment },
  { op: 'test', path: '/summary/currency_typo', value: 'x' },
  { op: 'replace', path: '/summary/sap_ytd', value: merged.summary.sap_ytd },
  { op: 'replace', path: '/does/not/exist', value: 1 },
];
const patched = JSON.parse(await run('Apply Patches', { patch_key: 'patches' }, { payload: JSON.stringify(fix), patches: '```json\n' + JSON.stringify(patches) + '\n```' }));
const log = patched.meta.patch_log;
assert.deepEqual(log.map((l) => l.result.split(':')[0]), ['applied', 'applied', 'skipped', 'applied', 'skipped']);
ok('applies add / replace, skips a failed test and a bad path, and logs each operation');
delete patched.meta.patch_log;
assert.deepEqual(patched, merged);
v = await validate(patched);
assert.equal(v.valid, true);
ok('the patched payload equals the original and validates again (repair loop closes)');
const moved = JSON.parse(await run('Apply Patches', { patch_key: 'patches' }, {
  payload: JSON.stringify({ meta: {}, a: { x: 1 }, b: [1, 2] }),
  patches: JSON.stringify([{ op: 'move', from: '/a/x', path: '/c' }, { op: 'copy', from: '/b', path: '/d' }, { op: 'remove', path: '/b/0' }, { op: 'add', path: '/b/-', value: 3 }]),
}));
assert.deepEqual({ a: moved.a, b: moved.b, c: moved.c, d: moved.d }, { a: {}, b: [2, 3], c: 1, d: [1, 2] });
ok('move, copy, remove and array append follow RFC 6902');
const noPatch = JSON.parse(await run('Apply Patches', { patch_key: 'patches' }, { payload: JSON.stringify(merged), patches: 'I fixed it.' }));
assert.equal(noPatch.meta.patch_log[0].result.startsWith('skipped'), true);
ok('a non-patch reply from the repair agent leaves the payload unchanged and is logged');


// ---------------------------------------------------------------- Apply Corrections (same code, reconciliation source)
console.log('Apply Corrections');
const drift = JSON.parse(JSON.stringify(merged));
drift.projects[3].ytd += 10;
const corrections = [{ op: 'replace', path: '/projects/3/ytd', value: merged.projects[3].ytd, reason: 'SAP YTD differs between grains' }];
const corrected = JSON.parse(await run('Apply Corrections', { patch_key: 'reconciliation' }, {
  payload: JSON.stringify({ ...drift, meta: { ...drift.meta, merge_warnings: ['kept for the validator'] } }),
  reconciliation: JSON.stringify({ corrections, summary: {} }),
}));
assert.equal(corrected.projects[3].ytd, merged.projects[3].ytd);
assert.equal(corrected.meta.patch_log[0].reason, 'SAP YTD differs between grains');
assert.deepEqual(corrected.meta.merge_warnings, ['kept for the validator']);
ok('applies the reconciliation agent\'s corrections, logs the reason, and leaves merge warnings for the validator');
const none = JSON.parse(await run('Apply Corrections', { patch_key: 'reconciliation' }, { payload: JSON.stringify(merged), reconciliation: JSON.stringify({ corrections: [] }) }));
delete none.meta.patch_log;
assert.deepEqual(none, merged);
ok('no corrections leaves the payload unchanged');

// ---------------------------------------------------------------- graph
console.log('Graph');
const ids = new Set(flow.nodes.map((n) => n.id));
const byLabel = (l) => flow.nodes.find((n) => n.data.label === l).id;
for (const e of flow.edges) {
  assert.ok(ids.has(e.source) && ids.has(e.target), e.id);
  const src = flow.nodes.find((n) => n.id === e.source);
  assert.ok((src.data.outputAnchors || []).some((a) => a.id === e.sourceHandle) || e.sourceHandle === e.source + '-output-' + src.data.name, e.sourceHandle);
}
const into = (l) => flow.edges.filter((e) => e.target === byLabel(l)).map((e) => flow.nodes.find((n) => n.id === e.source).data.label).sort();
assert.deepEqual(into('Reconciliation & Controls Agent'), ['Analytical Reporting Agent', 'Commercial Approval Agent', 'Financial Posting Agent']);
for (const g of ['Commercial Approval Agent', 'Financial Posting Agent', 'Analytical Reporting Agent']) assert.deepEqual(into(g), ['Data Standardisation Agent']);
const agents = flow.nodes.filter((n) => n.data.name === 'agentAgentflow');
assert.equal(agents.length, 6);
for (const a of agents) {
  assert.equal(a.data.inputs.agentModel, 'chatAnthropic', a.data.label);
  assert.match(a.data.inputs.agentModelConfig.modelName, /^claude-sonnet/);
}
const declared = new Set(flow.nodes.find((n) => n.data.name === 'startAgentflow').data.inputs.startState.map((s) => s.key));
for (const n of flow.nodes) for (const u of n.data.inputs.agentUpdateState || n.data.inputs.customFunctionUpdateState || []) assert.ok(declared.has(u.key), u.key);
ok('3 grain agents fan out from standardisation and join at reconciliation; 6 agents, all Claude Sonnet; state keys declared');

console.log(`\n${passed} checks passed`);
