import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader, Card } from '../components/ui.jsx';
import { LoadState, Money, SeverityBadge, Kpi, Select, SectionNote, FlagChip } from '../components/insightsUi.jsx';
import { useInsights, gbpShort, shortWbs } from '../lib/insights.js';

const SEVERITIES = ['high', 'medium', 'low', 'info'];

function EntityLink({ e, onNavigate }) {
  const map = { project: 'Projects', po: 'PurchaseOrders', submission: 'Investments' };
  if (map[e.entity_type]) {
    return <button onClick={() => onNavigate(map[e.entity_type], e.entity_id)} className="font-semibold text-teal-700 hover:underline">{e.entity_id}</button>;
  }
  const label = e.entity_type === 'wbs' ? shortWbs(e.entity_id) : e.entity_id;
  return <span className="font-mono" title={e.entity_id}>{label}</span>;
}

function ExceptionsView({ data, onNavigate, focus }) {
  const [severity, setSeverity] = useState('all');
  const [req, setReq] = useState('all');
  const [owner, setOwner] = useState('all');
  const [query, setQuery] = useState(focus || '');
  useEffect(() => { if (focus) setQuery(focus); }, [focus]);

  const all = data.exceptions;
  const reqs = useMemo(() => {
    const m = {};
    all.forEach((e) => { m[e.requirement] = (m[e.requirement] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [all]);
  const owners = useMemo(() => {
    const m = {};
    all.forEach((e) => {
      const k = e.owner || 'Unassigned';
      m[k] = m[k] || { count: 0, high: 0 };
      m[k].count += 1;
      if (e.severity === 'high' || e.severity === 'critical') m[k].high += 1;
    });
    return Object.entries(m).sort((a, b) => b[1].high - a[1].high || b[1].count - a[1].count);
  }, [all]);

  const q = query.trim().toLowerCase();
  const rows = all.filter((e) =>
    (severity === 'all' || e.severity === severity)
    && (req === 'all' || e.requirement === req)
    && (owner === 'all' || (e.owner || 'Unassigned') === owner)
    && (!q || [e.title, e.detail, e.entity_id, e.project, e.owner, e.rule, e.requirement].some((v) => String(v || '').toLowerCase().includes(q))));
  const bySev = (s) => all.filter((e) => e.severity === s);
  const highValue = bySev('high').reduce((a, e) => a + Math.abs(e.value || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Exceptions receive attention (G5)"
        title="Exception Monitor"
        subtitle="Rule-based exceptions raised from the workbook. Each one names the requirement it breaches and, where SAP holds one, the Person Responsible as owner (FOR-008)."
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="High severity" value={bySev('high').length} sub={`${gbpShort(highValue)} value at stake`} tone="bad" />
        <Kpi label="Medium" value={bySev('medium').length} sub="Control or mapping gaps" tone="warn" />
        <Kpi label="Low / info" value={bySev('low').length + bySev('info').length} sub="Hygiene and review backlog" />
        <Kpi label="Requirements touched" value={reqs.length} sub={`${owners.length} owners incl. unassigned`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_18rem] gap-6 items-start">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, project, WBS, owner…"
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-sm w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <Select value={severity} onChange={setSeverity} options={[{ value: 'all', label: 'All severities' }, ...SEVERITIES.map((s) => ({ value: s, label: s }))]} />
            <Select value={req} onChange={setReq} options={[{ value: 'all', label: 'All requirements' }, ...reqs.map(([r, n]) => ({ value: r, label: `${r} (${n})` }))]} />
            <Select value={owner} onChange={setOwner} options={[{ value: 'all', label: 'All owners' }, ...owners.map(([o, v]) => ({ value: o, label: `${o} (${v.count})` }))]} />
            <span className="text-xs text-slate-500">{rows.length} of {all.length}</span>
          </div>
          <Card className="!p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 pl-5">Severity</th>
                    <th className="px-3 py-2">Exception</th>
                    <th className="px-3 py-2">Entity</th>
                    <th className="px-3 py-2">Owner</th>
                    <th className="px-3 py-2">Req.</th>
                    <th className="px-3 py-2 text-right pr-5">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((e) => (
                    <tr key={e.id} className="align-top">
                      <td className="px-3 py-2.5 pl-5"><SeverityBadge severity={e.severity} /><div className="text-[11px] text-slate-400 mt-1">{e.id}</div></td>
                      <td className="px-3 py-2.5 max-w-md">
                        <div className="text-xs font-bold text-slate-900">{e.title}</div>
                        <div className="text-xs text-slate-600">{e.detail}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{e.source} · rule {e.rule}</div>
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        <div className="text-[11px] uppercase text-slate-400">{e.entity_type}</div>
                        <EntityLink e={e} onNavigate={onNavigate} />
                        {e.project && e.entity_type !== 'project' && (
                          <div><button onClick={() => onNavigate('Projects', e.project)} className="text-[11px] text-teal-700 hover:underline">{e.project}</button></div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">{e.owner || <span className="text-slate-400">Unassigned</span>}</td>
                      <td className="px-3 py-2.5"><FlagChip tone="slate">{e.requirement}</FlagChip></td>
                      <td className="px-3 py-2.5 text-right pr-5">{e.value === null ? <span className="text-xs text-slate-400">—</span> : <Money value={e.value} short className="text-xs" />}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">No exceptions match the filters.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="By owner" subtitle="SAP Person Responsible">
            <div className="space-y-1.5">
              {owners.map(([o, v]) => (
                <button key={o} onClick={() => setOwner(owner === o ? 'all' : o)} className={`w-full flex items-center justify-between rounded-lg px-2 py-1.5 text-xs ${owner === o ? 'bg-teal-50 text-teal-800' : 'hover:bg-slate-50'}`}>
                  <span className="font-semibold">{o}</span>
                  <span><span className="font-bold text-rose-700">{v.high}</span><span className="text-slate-400"> high · </span>{v.count}</span>
                </button>
              ))}
            </div>
            <SectionNote>Unassigned exceptions come from Copperleaf and PO data, which carry no owner field.</SectionNote>
          </Card>
          <Card title="By requirement">
            <div className="flex flex-wrap gap-1.5">
              {reqs.map(([r, n]) => (
                <button key={r} onClick={() => setReq(req === r ? 'all' : r)} className={`px-2 py-1 rounded-lg border text-xs font-semibold ${req === r ? 'bg-teal-50 border-teal-200 text-teal-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                  {r} <span className="text-slate-400">{n}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function ExceptionMonitor({ onNavigate, focus }) {
  const state = useInsights();
  return <LoadState state={state}>{(data) => <ExceptionsView data={data} onNavigate={onNavigate} focus={focus} />}</LoadState>;
}
