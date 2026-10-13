import React, { useState } from 'react';
import { PageHeader, Card } from '../components/ui.jsx';
import { LoadState, CheckBadge, Kpi, Select } from '../components/insightsUi.jsx';
import { useInsights } from '../lib/insights.js';

const PAGE_IDS = {
  Overview: 'Dashboard',
  'Purchase Orders': 'PurchaseOrders',
  'Projects & WBS': 'Projects',
  'Investment Traceability': 'Investments',
  'Activity Analysis': 'Activities',
  Exceptions: 'Exceptions',
  'Data Quality': 'DataQuality',
};

function RequirementsView({ data, onNavigate }) {
  const [query, setQuery] = useState('');
  const [section, setSection] = useState('all');
  const [status, setStatus] = useState('all');
  const reqs = data.requirements;
  const sections = [...new Set(reqs.map((r) => r.section))];
  const count = (s) => reqs.filter((r) => r.status === s).length;
  const q = query.trim().toLowerCase();
  const rows = reqs.filter((r) =>
    (section === 'all' || r.section === section)
    && (status === 'all' || r.status === status)
    && (!q || [r.id, r.text, r.metric, r.evidence].some((v) => String(v || '').toLowerCase().includes(q))));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="P&A-REQ-001 v0.1"
        title="Requirements Map"
        subtitle="Every mandatory requirement from the Cost Granularity requirements baseline, evaluated against the input workbook. Status is computed from the data, not asserted."
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Met by the data" value={count('met')} sub={`of ${reqs.length} requirements`} />
        <Kpi label="Partially met" value={count('partial')} sub="Evidence present with exceptions or missing measures" tone="warn" />
        <Kpi label="Gap" value={count('gap')} sub="Data breaches the requirement" tone="bad" />
        <Kpi label="Not evidenced" value={count('not evidenced')} sub="Input has no data for it (process, versioning, P6, FastDraft)" />
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search ID, text or evidence…"
          className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-sm w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <Select value={section} onChange={setSection} options={[{ value: 'all', label: 'All sections' }, ...sections.map((s) => ({ value: s, label: s }))]} />
        <Select value={status} onChange={setStatus} options={[{ value: 'all', label: 'All statuses' }, ...['met', 'partial', 'gap', 'not evidenced'].map((s) => ({ value: s, label: s }))]} />
        <span className="self-center text-xs text-slate-500">{rows.length} shown</span>
      </div>
      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 pl-5 w-24">ID</th>
                <th className="px-3 py-2">Requirement</th>
                <th className="px-3 py-2">Evidence from the data</th>
                <th className="px-3 py-2 w-28">Status</th>
                <th className="px-3 py-2 pr-5">Where</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="px-3 py-2.5 pl-5 font-mono text-xs font-bold text-teal-700 whitespace-nowrap">{r.id}</td>
                  <td className="px-3 py-2.5 max-w-md">
                    <div className="text-xs text-slate-800">{r.text}</div>
                    {r.acceptance && <div className="text-[11px] text-slate-500 mt-1">Acceptance: {r.acceptance}</div>}
                  </td>
                  <td className="px-3 py-2.5 max-w-sm">
                    {r.metric && <div className="text-xs font-bold text-slate-900">{r.metric}</div>}
                    <div className="text-xs text-slate-600">{r.evidence}</div>
                  </td>
                  <td className="px-3 py-2.5"><CheckBadge status={r.status} /></td>
                  <td className="px-3 py-2.5 pr-5 text-xs whitespace-nowrap">
                    {r.page && <button onClick={() => onNavigate(PAGE_IDS[r.page] || 'Dashboard')} className="font-semibold text-teal-700 hover:underline">{r.page}</button>}
                    {r.exceptions > 0 && (
                      <div><button onClick={() => onNavigate('Exceptions', r.id)} className="text-rose-700 hover:underline">{r.exceptions} exceptions</button></div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default function RequirementsMap({ onNavigate }) {
  const state = useInsights();
  return <LoadState state={state}>{(data) => <RequirementsView data={data} onNavigate={onNavigate} />}</LoadState>;
}
