/*
 * Apply Patches (mechanical JSON Patch application - no business logic)
 *
 * Input:   $patch_key - the state key holding the patches:
 *            "reconciliation" (Apply Corrections: the Reconciliation & Controls Agent's "corrections")
 *            "patches"        (Apply Patches: the Payload Repair Agent's RFC 6902 array)
 * Reads:   $flow.state.payload, $flow.state[$patch_key]
 * Writes:  $flow.state.payload
 *
 * Supports add, remove, replace, move, copy and test. Each operation is applied on its own: one that
 * fails (bad path, failed test) is skipped and recorded in meta.patch_log rather than aborting the rest,
 * so the validator re-checks whatever is still wrong on the next pass.
 *
 * Returns (JSON string): the patched payload
 */
function parseAgentJson(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw === 'object') return raw;
  let s = String(raw).trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  try { return JSON.parse(s); } catch (e) { /* fall through */ }
  const a = s.search(/[\[{]/);
  const b = Math.max(s.lastIndexOf(']'), s.lastIndexOf('}'));
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; } }
  return null;
}

const tokens = (path) => {
  if (path === '' || path === '/') return [];
  if (typeof path !== 'string' || !path.startsWith('/')) throw new Error('invalid path ' + JSON.stringify(path));
  return path.slice(1).split('/').map((t) => t.replace(/~1/g, '/').replace(/~0/g, '~'));
};
function locate(doc, path) {
  const t = tokens(path);
  if (!t.length) throw new Error('cannot target the document root');
  let parent = doc;
  for (const k of t.slice(0, -1)) {
    const next = Array.isArray(parent) ? parent[+k] : parent[k];
    if (next === undefined || next === null || typeof next !== 'object') throw new Error('path not found: ' + path);
    parent = next;
  }
  return { parent, key: t[t.length - 1] };
}
function get(doc, path) {
  let cur = doc;
  for (const k of tokens(path)) {
    if (cur === null || typeof cur !== 'object' || !(Array.isArray(cur) ? +k < cur.length : k in cur)) throw new Error('path not found: ' + path);
    cur = Array.isArray(cur) ? cur[+k] : cur[k];
  }
  return cur;
}
function remove(doc, path) {
  const { parent, key } = locate(doc, path);
  if (Array.isArray(parent)) {
    const i = +key;
    if (!(i >= 0 && i < parent.length)) throw new Error('index out of range: ' + path);
    return parent.splice(i, 1)[0];
  }
  if (!(key in parent)) throw new Error('path not found: ' + path);
  const old = parent[key];
  delete parent[key];
  return old;
}
function add(doc, path, value) {
  const { parent, key } = locate(doc, path);
  if (Array.isArray(parent)) {
    const i = key === '-' ? parent.length : +key;
    if (!(i >= 0 && i <= parent.length)) throw new Error('index out of range: ' + path);
    parent.splice(i, 0, value);
  } else {
    parent[key] = value;
  }
}
function replace(doc, path, value) {
  const { parent, key } = locate(doc, path);
  if (Array.isArray(parent) ? !(+key >= 0 && +key < parent.length) : !(key in parent)) throw new Error('path not found: ' + path);
  parent[Array.isArray(parent) ? +key : key] = value;
}
const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

let payload;
try {
  const raw = $flow.state.payload;
  payload = typeof raw === 'string' ? JSON.parse(raw) : clone(raw);
} catch (e) {
  throw new Error('Apply Patches: the payload in state is not valid JSON: ' + e.message);
}
const key = (typeof $patch_key === 'string' && $patch_key.trim()) || 'patches';
let ops = parseAgentJson($flow.state[key]);
if (ops && !Array.isArray(ops)) ops = Array.isArray(ops.corrections) ? ops.corrections : ops.patches;
const log = [];
if (!Array.isArray(ops)) {
  log.push({ op: null, source: key, result: 'skipped: ' + key + ' has no JSON Patch array' });
  ops = [];
}

for (const op of ops) {
  try {
    switch (op && op.op) {
      case 'add': add(payload, op.path, clone(op.value)); break;
      case 'remove': remove(payload, op.path); break;
      case 'replace': replace(payload, op.path, clone(op.value)); break;
      case 'move': { const v = remove(payload, op.from); add(payload, op.path, v); break; }
      case 'copy': add(payload, op.path, clone(get(payload, op.from))); break;
      case 'test':
        if (JSON.stringify(get(payload, op.path)) !== JSON.stringify(op.value)) throw new Error('test failed at ' + op.path);
        break;
      default: throw new Error('unsupported op ' + JSON.stringify(op && op.op));
    }
    log.push({ op: op.op, path: op.path, source: key, ...(op.reason ? { reason: op.reason } : {}), result: 'applied' });
  } catch (e) {
    log.push({ op: op && op.op, path: op && op.path, source: key, result: 'skipped: ' + e.message });
  }
}

if (payload.meta && typeof payload.meta === 'object') {
  // merge warnings are reported once by the validator; a repair pass clears them so the loop can close
  if (key === 'patches') delete payload.meta.merge_warnings;
  payload.meta.patch_log = (payload.meta.patch_log || []).concat(log);
}
return JSON.stringify(payload);
