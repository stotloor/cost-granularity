// Insight data for every page, computed by the backend from the input workbook.
// With VITE_API_URL set it is fetched from /api/insights; without it the app uses
// insightsSnapshot.json, exported by the same engine:
//   cd backend && python3 -m apexapp.insights --export ../frontend/src/lib/insightsSnapshot.json
import { useEffect, useState } from 'react';
import { API_URL, USE_MOCK } from './apexConfig.js';

let pending = null;

export function loadInsights() {
  if (!pending) {
    pending = USE_MOCK
      ? import('./insightsSnapshot.json').then((m) => m.default)
      : fetch(API_URL + '/api/insights').then(async (res) => {
          if (!res.ok) {
            const d = await res.json().catch(() => ({}));
            throw new Error(d.detail || 'Insights request failed (' + res.status + ')');
          }
          return res.json();
        });
    pending.catch(() => { pending = null; });
  }
  return pending;
}

export function useInsights() {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  useEffect(() => {
    let live = true;
    loadInsights()
      .then((data) => live && setState({ data, error: null, loading: false }))
      .catch((error) => live && setState({ data: null, error, loading: false }));
    return () => { live = false; };
  }, []);
  return state;
}

const GBP = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });

export function gbp(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return GBP.format(v);
}

export function gbpShort(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const a = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  if (a >= 1e9) return sign + '£' + (a / 1e9).toFixed(2) + 'bn';
  if (a >= 1e6) return sign + '£' + (a / 1e6).toFixed(a >= 1e7 ? 1 : 2) + 'm';
  if (a >= 1e3) return sign + '£' + (a / 1e3).toFixed(a >= 1e5 ? 0 : 1) + 'k';
  return sign + '£' + a.toFixed(0);
}

export function pct(v, digits = 1) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return (v * 100).toFixed(digits) + '%';
}

// Long anonymised WBS codes: keep the distinguishing tail readable.
export function shortWbs(wbs) {
  if (!wbs) return '—';
  const seg = wbs.split('-');
  return seg.length > 1 ? '…-' + seg.slice(1).map((s) => s.replace('PROJECT ', '')).join('-') : wbs;
}
