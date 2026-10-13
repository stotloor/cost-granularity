import React, { useEffect, useState } from 'react';
import { PageHeader, Card } from '../components/ui.jsx';
import { IconChevronDown, IconChevronRight } from '../components/icons.jsx';
import { LoadState, Money, Flags, FlagChip, Kpi, PeriodBars, Sparkbars, SectionNote, Select } from '../components/insightsUi.jsx';
import { useInsights, gbp, gbpShort, pct } from '../lib/insights.js';

function TreeRows({ nodes, depth, open, toggle }) {
  return nodes.map((n) => {
    const hasKids = n.children && n.children.length > 0;
    const isOpen = open.has(n.id);
    return (
      <React.Fragment key={n.id}>
        <tr className={`align-top ${n.posting ? '' : 'bg-slate-50/60'}`}>
          <td className="px-3 py-2">
            <div className="flex items-start gap-1.5" style={{ paddingLeft: depth * 18 + 'px' }}>
              {hasKids ? (
                <button onClick={() => toggle(n.id)} className="mt-0.5 text-slate-500 hover:text-slate-900">
                  {isOpen ? <IconChevronDown className="h-3.5 w-3.5" /> : <IconChevronRight className="h-3.5 w-3.5" />}
                </button>
              ) : <span className="w-3.5" />}
              <div className="min-w-0">
                <div className={`text-xs ${n.posting ? 'font-semibold text-slate-900' : 'font-bold text-slate-600'}`}>
                  {n.description || (depth === 0 ? 'Project root' : 'Summary node')}
                  <span className="ml-1.5 font-mono font-normal text-[11px] text-slate-400" title={n.id}>L{n.level} · {n.label}</span>
                </div>
                {n.posting && n.activity && n.activity !== n.description && (
                  <div className="text-[11px] text-teal-700">activity: {n.activity}</div>
                )}
              </div>
            </div>
          </td>
          <td className="px-3 py-2 text-right">
            <Money value={n.ytd} className={`text-xs ${n.posting ? '' : 'font-bold'}`} />
            {n.posting && hasKids && n.own_ytd !== null && <div className="text-[11px] text-slate-500">own {gbpShort(n.own_ytd)}</div>}
          </td>
          <td className="px-3 py-2"><Sparkbars values={n.periods} /></td>
          <td className="px-3 py-2 text-right">{n.po_allocated ? <Money value={n.po_allocated} className="text-xs" /> : <span className="text-xs text-slate-400">—</span>}</td>
          <td className="px-3 py-2">{n.posting ? <Flags flags={n.flags} /> : null}</td>
        </tr>
        {hasKids && isOpen && <TreeRows nodes={n.children} depth={depth + 1} open={open} toggle={toggle} />}
      </React.Fragment>
    );
  });
}

function allIds(nodes, out = []) {
  nodes.forEach((n) => { out.push(n.id); allIds(n.children || [], out); });
  return out;
}

function ProjectDetail({ p, periods, onNavigate }) {
  const [open, setOpen] = useState(() => new Set(allIds(p.tree)));
  useEffect(() => setOpen(new Set(allIds(p.tree))), [p.project]);
  const toggle = (id) => setOpen((prev) => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="SAP YTD actual" value={gbpShort(p.ytd)} sub={`${p.wbs_count} WBS · debits ${gbpShort(p.gross_debits)} / credits ${gbpShort(p.credits)}`} tone={p.ytd < 0 ? 'warn' : undefined} />
        <Kpi label="Attributed to investments" value={`${p.attributed_pct.toFixed(2)}%`} sub={`${gbpShort(p.unattributed_actual)} unattributed`} tone={p.attributed_pct < 99.99 ? 'warn' : undefined} />
        <Kpi label="PO-allocated actual" value={gbpShort(p.po_allocated)} sub={p.po_numbers.length ? p.po_numbers.join(', ') : 'No PO allocations'} tone={p.po_allocated > p.ytd && p.po_allocated > 0 ? 'bad' : undefined} />
        <Kpi label="On placeholder activity" value={gbpShort(p.dummy_activity_value)} sub={p.dummy_activity ? 'Dummy regulatory code (ACT-001)' : 'Specific regulatory code'} tone={p.dummy_activity ? 'bad' : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Identifiers" subtitle="Persistent references used for cross-system matching (WBS-001)">
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-xs">
            <dt className="text-slate-500">Project</dt><dd className="font-semibold">{p.project} · {p.project_name}</dd>
            <dt className="text-slate-500">Owner</dt><dd className="font-semibold">{p.person_responsible}</dd>
            <dt className="text-slate-500">Company</dt><dd>{p.company_code}</dd>
            <dt className="text-slate-500">SAP initiative</dt><dd className="font-mono">{p.initiative_id}</dd>
            <dt className="text-slate-500">Scheme ref</dt>
            <dd className="font-mono">{p.scheme_ref} {(p.scheme_ref === 'TEMPLATE' || !p.scheme_ref) && <FlagChip>not populated</FlagChip>}</dd>
            <dt className="text-slate-500">Copperleaf PAC</dt>
            <dd className="font-mono">
              {p.pac_codes.join(', ') || '—'}{' '}
              {p.pac_codes.length > 0 && p.scheme_ref !== 'TEMPLATE' && !p.pac_codes.includes(p.scheme_ref) && <FlagChip tone="rose">mismatch</FlagChip>}
            </dd>
            <dt className="text-slate-500">Reg. activity</dt>
            <dd>{p.reg_activities.map(([c, d]) => <div key={c}><span className="font-mono font-bold">{c}</span> {d}</div>)}</dd>
          </dl>
        </Card>
        <Card title="Posting-period phasing" subtitle="Σ period columns for this project" className="lg:col-span-2">
          <PeriodBars labels={periods} values={p.periods} />
          <SectionNote>
            Period columns in the SAP extract sum to ~73% of YTD TOTAL for most rows (see Data Quality), so they show the shape of spend, not the amount. YTD TOTAL is the authoritative actual.
          </SectionNote>
        </Card>
      </div>

      <Card
        title="WBS hierarchy"
        subtitle="Rolled up from SAP posting elements; summary nodes are derived from the WBS code segments"
        headerAction={
          <div className="flex gap-3">
            <button onClick={() => setOpen(new Set(allIds(p.tree)))} className="text-xs font-semibold text-teal-700 hover:underline">Expand all</button>
            <button onClick={() => setOpen(new Set())} className="text-xs font-semibold text-slate-600 hover:underline">Collapse</button>
          </div>
        }
      >
        <div className="overflow-x-auto -mx-6">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 pl-6">WBS element</th>
                <th className="px-3 py-2 text-right">YTD (rollup)</th>
                <th className="px-3 py-2">P{periods.map((x) => x.slice(1)).join('–')}</th>
                <th className="px-3 py-2 text-right">PO allocated</th>
                <th className="px-3 py-2">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <TreeRows nodes={p.tree} depth={0} open={open} toggle={toggle} />
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Regulatory investments funding this project" subtitle="Copperleaf rows whose SAPProject is this project; attributed actual = SAP YTD × % of WBS">
        {p.investments.length ? (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 pl-6">Investment</th>
                  <th className="px-3 py-2">Submission</th>
                  <th className="px-3 py-2">Product / driver</th>
                  <th className="px-3 py-2">Funding</th>
                  <th className="px-3 py-2 text-right">% of WBS</th>
                  <th className="px-3 py-2 text-right">Attributed actual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {p.investments.map((i) => (
                  <tr key={i.investment_code}>
                    <td className="px-3 py-2 pl-6 text-xs"><span className="font-bold">{i.investment_code}</span> · {i.investment_name}<div className="text-[11px] text-slate-500">{i.site_id} · PAC {i.pac_code}</div></td>
                    <td className="px-3 py-2 text-xs"><button onClick={() => onNavigate('Investments', i.submission_id)} className="font-semibold text-teal-700 hover:underline">{i.submission_id}</button></td>
                    <td className="px-3 py-2 text-xs">{i.product}<div className="text-[11px] text-slate-500">{i.intervention_driver || '—'}</div></td>
                    <td className="px-3 py-2 text-xs">{i.funding_position} · {i.price_base || '—'}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{i.pct_of_wbs}%</td>
                    <td className="px-3 py-2 text-right"><Money value={i.attributed_actual} className="text-xs font-bold" /></td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-bold">
                  <td className="px-3 py-2 pl-6 text-xs" colSpan={4}>Total attributed</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{p.attributed_pct.toFixed(2)}%</td>
                  <td className="px-3 py-2 text-right"><Money value={p.attributed_actual} className="text-xs" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-rose-700">No regulatory investment is linked to this project (INV-001).</p>}
      </Card>
    </div>
  );
}

export default function Projects({ onNavigate, focus }) {
  const state = useInsights();
  const [selected, setSelected] = useState(focus || null);
  useEffect(() => { if (focus) setSelected(focus); }, [focus]);

  return (
    <LoadState state={state}>
      {(data) => {
        const projects = [...data.projects].sort((a, b) => Math.abs(b.ytd) - Math.abs(a.ytd));
        const current = projects.find((p) => p.project === selected) || projects[0];
        return (
          <div className="space-y-6">
            <PageHeader
              eyebrow="Financial posting grain"
              title="Projects & WBS"
              subtitle="SAP S/4 actuals by project and WBS element, with the regulatory activity, investment attribution and PO allocations that land on each element."
            />

            <Card title="All projects" subtitle="Select a project to drill into its WBS structure">
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2 pl-6">Project</th>
                      <th className="px-3 py-2">Owner</th>
                      <th className="px-3 py-2">Reg. activity</th>
                      <th className="px-3 py-2 text-right">SAP YTD</th>
                      <th className="px-3 py-2 text-right">Attributed</th>
                      <th className="px-3 py-2 text-right">PO allocated</th>
                      <th className="px-3 py-2 text-right">WBS</th>
                      <th className="px-3 py-2 text-right">Exceptions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {projects.map((p) => (
                      <tr
                        key={p.project}
                        onClick={() => setSelected(p.project)}
                        className={`cursor-pointer hover:bg-slate-50 ${p.project === current.project ? 'bg-teal-50/60' : ''}`}
                      >
                        <td className="px-3 py-2 pl-6 text-xs"><span className="font-bold text-slate-900">{p.project}</span> <span className="text-slate-500">· {p.project_name}</span></td>
                        <td className="px-3 py-2 text-xs">{p.person_responsible}</td>
                        <td className="px-3 py-2 text-xs">
                          {p.reg_activities.map(([c]) => c).join(', ')} {p.dummy_activity && <FlagChip tone="rose">placeholder</FlagChip>}
                        </td>
                        <td className="px-3 py-2 text-right"><Money value={p.ytd} short className="text-xs font-bold" /></td>
                        <td className={`px-3 py-2 text-right font-mono text-xs ${p.attributed_pct < 99.99 ? 'text-amber-700 font-bold' : ''}`}>{p.attributed_pct.toFixed(1)}%</td>
                        <td className="px-3 py-2 text-right">{p.po_allocated ? <Money value={p.po_allocated} short className={`text-xs ${p.po_allocated > p.ytd ? 'text-rose-700 font-bold' : ''}`} /> : <span className="text-xs text-slate-400">—</span>}</td>
                        <td className="px-3 py-2 text-right text-xs">{p.wbs_count}</td>
                        <td className="px-3 py-2 text-right">
                          <button onClick={(e) => { e.stopPropagation(); onNavigate('Exceptions', p.project); }} className="text-xs font-bold text-rose-700 hover:underline">{p.exception_count}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-bold text-slate-700">Project</span>
              <Select
                value={current.project}
                onChange={setSelected}
                options={projects.map((p) => ({ value: p.project, label: `${p.project} · ${p.project_name} · ${gbpShort(p.ytd)}` }))}
              />
              <span className="text-xs text-slate-500">{gbp(current.ytd)} SAP YTD · {pct(current.ytd / data.summary.sap_ytd)} of portfolio</span>
            </div>
            <ProjectDetail p={current} periods={data.summary.periods} onNavigate={onNavigate} />
          </div>
        );
      }}
    </LoadState>
  );
}
