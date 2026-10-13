/*
 * Validate Payload Schema (deterministic check of the agents' JSON - computes no insights)
 *
 * Reads:   $flow.state.payload
 * Writes:  $flow.state.validation
 *
 * 1. Shape: every top-level key, and every field / type of the frontend schema (the same sketch the section
 *    agents were given, generated from the backend's GET /api/insights output). null is accepted anywhere;
 *    "number|string" style unions accept any member.
 * 2. Cross-section totals: summary KPIs agree with the sections, PO allocations sum to actual posted,
 *    project codes are unique, exception and requirement counts match.
 * Each problem has a JSON Pointer path so the Payload Repair Agent can patch it.
 *
 * Returns (JSON string): { "valid": boolean, "problem_count": n, "problems": [{ path, problem, current }] }
 */
const SCHEMA = __PAYLOAD_SCHEMA__;
const SAME_SHAPE = '[same shape as this node]';
const DYNAMIC_MAPS = new Set(['/summary/exceptions_by_severity', '/summary/requirements_status']);
const MAX_PROBLEMS = 60;

const problems = [];
let total = 0;
const show = (v) => {
  if (v === undefined) return undefined;
  const s = JSON.stringify(v);
  return s && s.length > 200 ? s.slice(0, 200) + '…' : v;
};
const report = (path, problem, current) => {
  total += 1;
  if (problems.length < MAX_PROBLEMS) problems.push({ path: path || '/', problem, current: show(current) });
};
const ptr = (path, key) => path + '/' + String(key).replace(/~/g, '~0').replace(/\//g, '~1');
const kind = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

function check(value, schema, path, parentShape) {
  if (value === null || value === undefined || schema === 'null') return;
  if (schema === SAME_SHAPE) return check(value, [parentShape], path, parentShape);
  if (typeof schema === 'string') {
    // a union such as "number|string" accepts any of its members
    if (!schema.split('|').includes(kind(value))) report(path, 'expected ' + schema + ', got ' + kind(value), value);
    return;
  }
  if (Array.isArray(schema)) {
    if (!Array.isArray(value)) return report(path, 'expected array, got ' + kind(value), value);
    if (schema.length) value.forEach((item, i) => check(item, schema[0], ptr(path, i), parentShape));
    return;
  }
  if (kind(value) !== 'object') return report(path, 'expected object, got ' + kind(value), value);
  if (DYNAMIC_MAPS.has(path)) {
    for (const [k, v] of Object.entries(value)) if (typeof v !== 'number') report(ptr(path, k), 'expected number, got ' + kind(v), v);
    return;
  }
  const shape = 'children' in schema ? schema : parentShape;
  for (const [k, s] of Object.entries(schema)) {
    if (!(k in value)) report(ptr(path, k), 'missing field', undefined);
    else check(value[k], s, ptr(path, k), shape);
  }
}

// ---- parse
let payload;
try {
  const raw = $flow.state.payload;
  payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
} catch (e) {
  return JSON.stringify({ valid: false, problem_count: 1, problems: [{ path: '/', problem: 'payload is not valid JSON: ' + e.message }] });
}
if (kind(payload) !== 'object') {
  return JSON.stringify({ valid: false, problem_count: 1, problems: [{ path: '/', problem: 'payload is not a JSON object' }] });
}

// ---- 1. shape
for (const key of Object.keys(SCHEMA)) {
  if (!(key in payload)) report('/' + key, 'missing section', undefined);
  else check(payload[key], SCHEMA[key], '/' + key, null);
}
const warnings = payload.meta && payload.meta.merge_warnings;
if (Array.isArray(warnings)) warnings.forEach((w, i) => report('/meta/merge_warnings/' + i, 'merge: ' + w, undefined));

// ---- 2. cross-section totals
const num = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);
const sum = (arr, f) => (Array.isArray(arr) ? arr.reduce((a, x) => a + num(f(x || {})), 0) : 0);
const near = (a, b) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * 1e-6);
const s = payload.summary || {};
const agree = (path, expected, label) => {
  if (typeof s[path] !== 'number') return;
  if (!near(s[path], expected)) report('/summary/' + path, 'does not match ' + label + ' (' + Math.round(expected * 100) / 100 + ')', s[path]);
};
const projects = Array.isArray(payload.projects) ? payload.projects : [];
const pos = Array.isArray(payload.pos) ? payload.pos : [];
const exceptions = Array.isArray(payload.exceptions) ? payload.exceptions : [];
const checks = Array.isArray(payload.checks) ? payload.checks : [];
const requirements = Array.isArray(payload.requirements) ? payload.requirements : [];

agree('sap_ytd', sum(projects, (p) => p.ytd), 'Σ projects.ytd');
agree('project_count', projects.length, 'number of projects');
agree('wbs_count', sum(projects, (p) => p.wbs_count), 'Σ projects.wbs_count');
agree('po_count', pos.length, 'number of POs');
agree('po_value', sum(pos, (p) => p.po_value), 'Σ pos.po_value');
agree('po_actual_posted', sum(pos, (p) => p.actual_posted), 'Σ pos.actual_posted');
agree('allocation_lines', sum(pos, (p) => (Array.isArray(p.allocations) ? p.allocations.length : 0)), 'number of allocation lines');
if (Array.isArray(payload.investments)) agree('investment_count', payload.investments.length, 'number of investments');
if (Array.isArray(payload.submissions)) {
  agree('submission_count', payload.submissions.length, 'number of submissions');
  agree('planned_ecc', sum(payload.submissions, (x) => x.ecc), 'Σ submissions.ecc');
}
agree('exceptions', exceptions.length, 'number of exceptions');
if (s.exceptions_by_severity && typeof s.exceptions_by_severity === 'object') {
  const counts = {};
  exceptions.forEach((e) => { counts[e.severity] = (counts[e.severity] || 0) + 1; });
  for (const sev of new Set([...Object.keys(counts), ...Object.keys(s.exceptions_by_severity)])) {
    if ((counts[sev] || 0) !== num(s.exceptions_by_severity[sev])) report('/summary/exceptions_by_severity/' + sev, 'does not match exceptions list (' + (counts[sev] || 0) + ')', s.exceptions_by_severity[sev]);
  }
}
agree('checks_total', checks.length, 'number of checks');
agree('checks_failed', checks.filter((c) => c.status === 'fail').length, 'failed checks');
agree('checks_warn', checks.filter((c) => c.status === 'warn').length, 'warning checks');
if (s.requirements_status && typeof s.requirements_status === 'object') {
  const counts = {};
  requirements.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
  for (const st of new Set([...Object.keys(counts), ...Object.keys(s.requirements_status)])) {
    if ((counts[st] || 0) !== num(s.requirements_status[st])) report('/summary/requirements_status/' + st, 'does not match requirements list (' + (counts[st] || 0) + ')', s.requirements_status[st]);
  }
}

const codes = new Set();
projects.forEach((p, i) => {
  if (codes.has(p.project)) report('/projects/' + i + '/project', 'duplicate project code', p.project);
  codes.add(p.project);
  if (Array.isArray(p.wbs) && typeof p.wbs_count === 'number' && p.wbs.length !== p.wbs_count) report('/projects/' + i + '/wbs_count', 'does not match wbs rows (' + p.wbs.length + ')', p.wbs_count);
  if (Array.isArray(p.wbs) && typeof p.ytd === 'number' && !near(p.ytd, sum(p.wbs, (w) => w.ytd))) report('/projects/' + i + '/ytd', 'does not match Σ wbs.ytd (' + Math.round(sum(p.wbs, (w) => w.ytd) * 100) / 100 + ')', p.ytd);
});
pos.forEach((p, i) => {
  if (!Array.isArray(p.allocations)) return;
  const allocated = sum(p.allocations, (l) => l.final_allocated);
  if (typeof p.actual_posted === 'number' && !near(allocated, p.actual_posted) && !(p.checks && p.checks.allocated_matches_posted === false)) {
    report('/pos/' + i + '/allocations', 'Σ final_allocated (' + Math.round(allocated * 100) / 100 + ') differs from actual_posted without a failed check', p.actual_posted);
  }
  if (typeof p.po_value === 'number' && typeof p.actual_posted === 'number' && typeof p.remaining_commitment === 'number' && !near(p.remaining_commitment, p.po_value - p.actual_posted)) {
    report('/pos/' + i + '/remaining_commitment', 'should be po_value - actual_posted (' + (p.po_value - p.actual_posted) + ')', p.remaining_commitment);
  }
  if (typeof p.wbs_count === 'number' && p.wbs_count !== p.allocations.length) report('/pos/' + i + '/wbs_count', 'does not match allocation lines (' + p.allocations.length + ')', p.wbs_count);
  for (const l of p.allocations) {
    if (l && l.project && codes.size && !codes.has(l.project)) report('/pos/' + i + '/allocations', 'allocation to project ' + l.project + ' that is not in projects', l.allocation_id);
  }
});
const excIds = new Set();
exceptions.forEach((e, i) => {
  if (excIds.has(e.id)) report('/exceptions/' + i + '/id', 'duplicate exception id', e.id);
  excIds.add(e.id);
});

return JSON.stringify({ valid: total === 0, problem_count: total, problems });
