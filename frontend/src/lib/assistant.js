// AI Assistant client. With a backend (VITE_API_URL) it posts to /api/ai/assistant, which forwards
// to Flowise tagged with the logged-in user's email (for conversation history). Without one (mock
// mode) it posts straight to the Flowise prediction endpoint, anonymously; override that endpoint
// with VITE_ASSISTANT_URL.
import { API_URL, USE_MOCK } from './apexConfig.js';
import { authToken } from './apexHttp.js';

const DEFAULT_URL = 'https://apex.aziro.ai/apexflow/api/v1/prediction/8efad22c-6229-4e48-91a3-8e47cfc08052';
export const ASSISTANT_URL = USE_MOCK
  ? (import.meta.env && import.meta.env.VITE_ASSISTANT_URL) || DEFAULT_URL
  : API_URL + '/api/ai/assistant';

const TIMEOUT_MS = 180000; // agent runs with several tool calls can take a while
const HISTORY_TURNS = 10; // the flow has no server-side memory; send recent turns as context

// messages: [{ role: 'user' | 'assistant', content }]
export async function askAssistant(question, messages = [], signal) {
  const history = messages
    .filter((m) => !m.error)
    .slice(-HISTORY_TURNS * 2)
    .map((m) => ({ role: m.role === 'user' ? 'userMessage' : 'apiMessage', content: m.content }));

  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);
  const abort = () => timeout.abort();
  if (signal) signal.addEventListener('abort', abort);
  try {
    const res = await fetch(ASSISTANT_URL, {
      method: 'POST',
      headers: requestHeaders(),
      body: JSON.stringify({ question, history }),
      signal: timeout.signal,
    });
    const body = await res.text();
    if (!res.ok) throw new Error(errorMessage(body) || `Assistant request failed (${res.status})`);
    return parseAnswer(body);
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error(signal && signal.aborted ? 'Cancelled.' : 'The assistant took too long to respond. Try a narrower question.');
    }
    throw e;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', abort);
  }
}

function requestHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const t = !USE_MOCK && authToken();
  if (t) headers['Authorization'] = 'Bearer ' + t;
  return headers;
}

// The endpoint returns plain text; standard Flowise returns JSON { text, ... }. Accept both.
function parseAnswer(body) {
  const trimmed = body.trim();
  if (trimmed.startsWith('{')) {
    try {
      const data = JSON.parse(trimmed);
      if (typeof data.text === 'string') return data.text;
      if (data.json !== undefined) return '```json\n' + JSON.stringify(data.json, null, 2) + '\n```';
    } catch (_) { /* not JSON: fall through */ }
  }
  return trimmed;
}

function errorMessage(body) {
  try {
    const d = JSON.parse(body);
    return d.message || d.error || d.detail;
  } catch (_) {
    return body.slice(0, 300);
  }
}
