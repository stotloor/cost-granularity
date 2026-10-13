import React, { useState } from 'react';
import { PageHeader, Card } from '../components/ui.jsx';
import { LoadState, Money, FlagChip, Kpi, BarList, SectionNote, Tip } from '../components/insightsUi.jsx';
import { useInsights, gbp, gbpShort, pct } from '../lib/insights.js';

function Matrix({ data }) {
  const projects = [...data.projects].sort((a, b) => Math.abs(b.ytd) - Math.abs(a.ytd)).map((p) => p.project);
  const cell = {};
  data.projects.forEach((p) => p.wbs.forEach((w) => {
    const k = w.activity + '|' + p.project;
    cell[k] = (cell[k] || 0) + w.ytd;
  }));
  const max = Math.max(1, ...Object.values(cell).map((v) => Math.abs(v)));
  return (
    <div className="overflow-x-auto -mx-6">
      <table className="text-xs border-separate border-spacing-[2px]">
        <thead>
          <tr>
            <th className="sticky left-0 bg-white px-3 py-2 text-left text-[11px] uppercase tracking-wide text-slate-500 min-w-[13rem]">Activity</th>
            {projects.map((p) => <th key={p} className="px-2 py-2 text-[11px] font-semibold text-slate-600 whitespace-nowrap">{p.replace('PROJECT ', 'P')}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.activities.map((a) => (
            <tr key={a.activity}>
              <td className="sticky left-0 bg-white px-3 py-1.5 font-semibold text-slate-800 whitespace-nowrap">{a.activity}</td>
              {projects.map((p) => {
                const v = cell[a.activity + '|' + p];
                if (v === undefined) return <td key={p} className="px-2 py-1.5 text-center text-slate-300 bg-slate-50 rounded-[4px]">·</td>;
                const t = Math.abs(v) / max;
                // Sequential single hue for magnitude (log-ish so small values stay visible); credits in amber.
                const alpha = 0.08 + 0.72 * Math.sqrt(t);
                const bg = v < 0 ? `rgba(217,119,6,${alpha})` : `rgba(13,148,136,${alpha})`;
                return (
                  <td key={p} className="px-0 py-0 rounded-[4px]" style={{ background: bg }}>
                    <Tip content={<span>{a.activity} · {p}: {gbp(v)}</span>}>
                      <div className={`px-2 py-1.5 text-right font-mono whitespace-nowrap ${alpha > 0.5 ? 'text-white' : 'text-slate-800'}`}>{gbpShort(v)}</div>
                    </Tip>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ActivityAnalysis({ onNavigate }) {
  const state = useInsights();
  const [selected, setSelected] = useState(null);
  return (
    <LoadState state={state}>
      {(data) => {
        const s = data.summary;
        const changed = data.activity_mapping.filter((m) => m.changed);
        const sel = data.activities.find((a) => a.activity === selected);
        const wbsForSel = sel ? data.projects.flatMap((p) => p.wbs.filter((w) => w.activity === sel.activity)) : [];
        return (
          <div className="space-y-6">
            <PageHeader
              eyebrow="Activity taxonomy"
              title="Activity Analysis"
              subtitle="Where project-execution cost sits by regulatory activity code and by activity type, and how consistently activities are described across projects (ACT-001 – ACT-005)."
            />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Kpi label="Gross actual on placeholder codes" value={pct(s.dummy_activity_pct)} sub={`${gbpShort(s.dummy_activity_value)} on W99 / QQQ dummy codes`} tone="bad" />
              <Kpi label="Regulatory activity codes" value={data.reg_activities.length} sub={`${data.reg_activities.filter((r) => r.dummy).length} are placeholders`} />
              <Kpi label="Activity types" value={data.activities.length} sub={`from ${data.activity_mapping.length} raw WBS descriptions`} />
              <Kpi label="Descriptions normalised" value={changed.length} sub={`mapping ${data.meta.activity_mapping_version}`} tone={changed.length ? 'warn' : undefined} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card title="SAP actual by regulatory activity" subtitle="WBS Regulatory Activity code">
                <div className="space-y-3">
                  {data.reg_activities.map((r) => (
                    <div key={r.code} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-mono text-xs font-bold text-slate-900">{r.code}</span>
                          <span className="text-xs text-slate-600"> {r.description}</span>
                        </div>
                        {r.dummy && <FlagChip tone="rose">placeholder</FlagChip>}
                      </div>
                      <BarList items={[{ label: `${r.project_count} projects · ${r.wbs_count} WBS`, value: r.total }]} max={Math.max(...data.reg_activities.map((x) => Math.abs(x.total)))} />
                    </div>
                  ))}
                </div>
                <SectionNote>Cost on placeholder codes cannot be attributed to a regulatory activity until the correct code is assigned (BR-002).</SectionNote>
              </Card>
              <Card title="SAP actual by activity type" subtitle="Click an activity to list its WBS elements">
                <BarList
                  items={data.activities.map((a) => ({ ...a, label: a.activity, value: a.total }))}
                  sublabel={(a) => `${a.project_count} projects · ${a.wbs_count} WBS${a.variants.length > 1 ? ' · ' + a.variants.length + ' spellings' : ''}`}
                  onSelect={(a) => setSelected(a.activity)}
                />
              </Card>
            </div>

            {sel && (
              <Card title={`WBS elements for "${sel.activity}"`} subtitle={`Raw descriptions: ${sel.variants.join(' · ')}`} headerAction={<button onClick={() => setSelected(null)} className="text-xs font-semibold text-slate-600 hover:underline">Close</button>}>
                <div className="overflow-x-auto -mx-6">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                      <tr><th className="px-3 py-2 pl-6">Project</th><th className="px-3 py-2">WBS description</th><th className="px-3 py-2">Reg. activity</th><th className="px-3 py-2 text-right">SAP YTD</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {wbsForSel.map((w) => (
                        <tr key={w.wbs}>
                          <td className="px-3 py-2 pl-6 text-xs"><button onClick={() => onNavigate('Projects', w.project)} className="font-semibold text-teal-700 hover:underline">{w.project}</button></td>
                          <td className="px-3 py-2 text-xs">{w.wbs_description}</td>
                          <td className="px-3 py-2 text-xs font-mono">{w.reg_activity}</td>
                          <td className="px-3 py-2 text-right"><Money value={w.ytd} className="text-xs" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            <Card title="Activity × project" subtitle="SAP YTD by activity type and project — compare how equivalent work is costed across projects (ACT-002, ACT-003)">
              <Matrix data={data} />
              <SectionNote>Teal shading scales with magnitude; amber cells are net credits. Hover a cell for the exact value.</SectionNote>
            </Card>

            <Card title="Description → activity mapping" subtitle={`System-derived, version ${data.meta.activity_mapping_version} (GRN-009, ACT-004). Only normalised descriptions are listed.`}>
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <tr><th className="px-3 py-2 pl-6">Raw WBS description</th><th className="px-3 py-2">Activity</th><th className="px-3 py-2">Rule applied</th><th className="px-3 py-2">Origin</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {changed.map((m) => (
                      <tr key={m.raw}>
                        <td className="px-3 py-2 pl-6 text-xs font-mono">{m.raw}</td>
                        <td className="px-3 py-2 text-xs font-semibold">{m.canonical}</td>
                        <td className="px-3 py-2 text-xs">{m.rules.join('; ')}</td>
                        <td className="px-3 py-2"><FlagChip tone="slate">{m.origin}</FlagChip></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        );
      }}
    </LoadState>
  );
}
