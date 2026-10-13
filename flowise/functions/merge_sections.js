/*
 * Merge Sections (concatenation only - no business logic)
 *
 * Reads:   $flow.state.grain_commercial, grain_financial, grain_analytical, reconciliation - the agents' outputs
 * Writes:  $flow.state.payload
 *
 * Places each agent's sections into one GET /api/insights document in the frontend's key order; keys an
 * agent returns for the others (alloc_by_wbs, coverage, corrections, ...) are left out. projects are
 * sorted by project code (duplicates dropped). Agent text is parsed tolerantly
 * (markdown fences or prose around the JSON are ignored). Anything that cannot be merged is listed in
 * meta.merge_warnings for the validator to report.
 *
 * Returns (JSON string): the full payload
 */
const SECTIONS = __SECTION_STATE__;
const KEY_ORDER = __REQUIRED_KEYS__;

function parseAgentJson(raw) {
  if (raw === undefined || raw === null || raw === '') return { error: 'empty' };
  if (typeof raw === 'object') return { value: raw };
  let s = String(raw).trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  try { return { value: JSON.parse(s) }; } catch (e) { /* fall through */ }
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) {
    try { return { value: JSON.parse(s.slice(a, b + 1)) }; } catch (e) { return { error: 'not valid JSON: ' + e.message }; }
  }
  return { error: 'no JSON object found' };
}

const state = $flow.state || {};
const parts = {};
const warnings = [];
const projects = [];
for (const [stateKey, keys] of Object.entries(SECTIONS)) {
  const parsed = parseAgentJson(state[stateKey]);
  if (parsed.error) { warnings.push(stateKey + ': ' + parsed.error); continue; }
  for (const k of keys) {
    if (!(k in parsed.value)) { warnings.push(stateKey + ': missing key "' + k + '"'); continue; }
    if (k === 'projects') {
      const list = parsed.value.projects;
      if (Array.isArray(list)) projects.push(...list);
      else warnings.push(stateKey + ': "projects" is not an array');
    } else if (k in parts) {
      warnings.push(stateKey + ': duplicate key "' + k + '" ignored');
    } else {
      parts[k] = parsed.value[k];
    }
  }
}

const seen = new Set();
const merged = [];
for (const p of projects.sort((x, y) => String(x && x.project).localeCompare(String(y && y.project)))) {
  const code = p && p.project;
  if (seen.has(code)) { warnings.push('projects: duplicate project ' + code + ' dropped'); continue; }
  seen.add(code);
  merged.push(p);
}
if (projects.length) parts.projects = merged;

const payload = {};
for (const k of KEY_ORDER) if (k in parts) payload[k] = parts[k];
if (warnings.length) {
  payload.meta = { ...(payload.meta || {}), merge_warnings: warnings };
}
return JSON.stringify(payload);
