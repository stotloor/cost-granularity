import React, { useEffect, useState } from 'react';
import { PageHeader, Card, Tabs } from '../components/ui.jsx';
import { IconChevronDown, IconChevronRight, IconArrowRight } from '../components/icons.jsx';
import { LoadState, Money, FlagChip, Kpi, BarList, SectionNote, Tip } from '../components/insightsUi.jsx';
import { useInsights, gbp, gbpShort, pct } from '../lib/insights.js';

const LINK_TONE = { linked: 'teal', 'no SAP project': 'amber', 'invalid reference': 'rose' };

function ChainStep({ label, value, sub, last }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
        <div className="text-sm font-bold text-slate-900 truncate">{value}</div>
        {sub && <div className="text-[11px] text-slate-500 truncate">{sub}</div>}
      </div>
      {!last && <IconArrowRight className="h-4 w-4 text-slate-400 shrink-0" />}
    </div>
  );
}

function SubmissionDetail({ sub, investments, projects, onNavigate }) {
  const members = investments.filter((i) => i.submission_id === sub.submission_id);
  const linkedProjects = projects.filter((p) => sub.sap_projects.includes(p.project));
  return (
    <div className="border-t border-slate-100 bg-slate-50/50 px-4 sm:px-6 py-5 space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <ChainStep label="Regulatory submission" value={sub.submission_id} sub={`${gbpShort(sub.ecc)} planned ECC`} />
        <ChainStep label="Investments" value={sub.investment_count} sub={sub.products.join(', ')} />
        <ChainStep label="SAP projects" value={sub.sap_projects.length || 'none'} sub={sub.sap_projects.join(', ') || 'no link'} />
        <ChainStep label="WBS elements" value={linkedProjects.reduce((a, p) => a + p.wbs_count, 0)} sub="posting grain" />
        <ChainStep label="Attributed actual" value={gbpShort(sub.attributed_actual)} sub={sub.spend_to_plan !== null ? pct(sub.spend_to_plan) + ' of plan' : 'no plan value'} last />
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Investment</th>
              <th className="px-3 py-2">Location</th>
              <th className="px-3 py-2">Driver / funding</th>
              <th className="px-3 py-2">SAP link</th>
              <th className="px-3 py-2 text-right">% of WBS</th>
              <th className="px-3 py-2 text-right">ECC (source)</th>
              <th className="px-3 py-2 text-right">ECC counted</th>
              <th className="px-3 py-2 text-right">Attributed actual</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {members.map((i) => (
              <tr key={i.investment_code} className="align-top">
                <td className="px-3 py-2 text-xs"><span className="font-bold">{i.investment_code}</span><div className="text-slate-500">{i.investment_name} · PAC {i.pac_code}</div></td>
                <td className="px-3 py-2 text-xs">{i.area}<div className="text-slate-500">{i.facility} · {i.site_id}</div></td>
                <td className="px-3 py-2 text-xs">{i.intervention_driver || '—'}<div className="text-slate-500">{i.funding_position} · {i.price_base || 'no price base'}</div></td>
                <td className="px-3 py-2 text-xs">
                  {i.sap_project
                    ? <button onClick={() => onNavigate('Projects', i.sap_project)} className="font-semibold text-teal-700 hover:underline">{i.sap_project}</button>
                    : <FlagChip tone={LINK_TONE[i.link_status]}>{i.link_status}{i.sap_project_raw === 0 ? ' (0)' : ''}</FlagChip>}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs">{i.pct_of_wbs === null ? '—' : i.pct_of_wbs + '%'}</td>
                <td className="px-3 py-2 text-right text-xs">
                  {i.ecc_status === 'invalid' ? (
                    <Tip content={<span>Raw: {String(i.ecc_raw)} · possible recovery {gbp(i.ecc_candidate)}</span>}>
                      <FlagChip tone="rose">quarantined</FlagChip>
                    </Tip>
                  ) : <Money value={i.ecc} />}
                  {i.ecc_status === 'text' && <div><FlagChip>stored as text</FlagChip></div>}
                </td>
                <td className="px-3 py-2 text-right text-xs">
                  <Money value={i.ecc_counted} />
                  {i.flags.includes('duplicate ECC') && <div><FlagChip>duplicate – not counted</FlagChip></div>}
                </td>
                <td className="px-3 py-2 text-right text-xs">{i.attributed_actual === null ? <span className="text-slate-400">—</span> : <Money value={i.attributed_actual} className="font-bold" />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function InvestmentTraceability({ onNavigate, focus }) {
  const state = useInsights();
  const [open, setOpen] = useState(() => new Set(focus ? [focus] : []));
  const [dim, setDim] = useState('product');
  const [onlyIssues, setOnlyIssues] = useState(false);
  useEffect(() => { if (focus) setOpen((s) => new Set([...s, focus])); }, [focus]);

  return (
    <LoadState state={state}>
      {(data) => {
        const s = data.summary;
        const linked = data.investments.filter((i) => i.link_status === 'linked').length;
        const subs = [...data.submissions]
          .filter((x) => !onlyIssues || x.duplicate_exposure > 0 || x.quarantined.length || !x.sap_projects.length || x.price_bases.length > 1)
          .sort((a, b) => b.ecc - a.ecc);
        const toggle = (id) => setOpen((prev) => {
          const n = new Set(prev);
          n.has(id) ? n.delete(id) : n.add(id);
          return n;
        });
        const coverage = [...data.projects].sort((a, b) => a.attributed_pct - b.attributed_pct);
        return (
          <div className="space-y-6">
            <PageHeader
              eyebrow="Analytical / regulatory grain"
              title="Investment Traceability"
              subtitle="Regulatory submission → investment → SAP project → WBS → actual (BR-001, BR-003). Planned cost comes from Copperleaf; actual is SAP YTD attributed by each investment's % of WBS."
            />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Kpi label="Planned ECC (de-duplicated)" value={gbpShort(s.planned_ecc)} sub={`plain sum would be ${gbpShort(s.planned_ecc_naive)}`} />
              <Kpi label="Planned ECC quarantined" value={gbpShort(s.planned_ecc_quarantined)} sub={`${data.investments.filter((i) => i.ecc_status === 'invalid').length} non-numeric values excluded (INT-004)`} tone="bad" />
              <Kpi label="SAP actual attributed" value={pct(s.attribution_pct)} sub={`${gbpShort(s.attributed_actual)} of ${gbpShort(s.sap_ytd)}`} tone={s.attribution_pct < 0.9999 ? 'warn' : undefined} />
              <Kpi label="Investments linked to SAP" value={`${linked} / ${s.investment_count}`} sub={`${s.investment_count - linked} with no or invalid SAP project`} tone={linked < s.investment_count ? 'warn' : undefined} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card title="Attribution coverage by SAP project" subtitle="Σ Copperleaf % of WBS per project — below 100% leaves actuals with no regulatory investment">
                <div className="space-y-2">
                  {coverage.map((p) => {
                    const w = Math.min(100, p.attributed_pct);
                    return (
                      <button key={p.project} onClick={() => onNavigate('Projects', p.project)} className="w-full text-left grid grid-cols-[7rem_1fr_7rem] items-center gap-3 rounded-lg hover:bg-slate-50 px-1 -mx-1">
                        <span className="text-xs font-semibold text-slate-800">{p.project}</span>
                        <Tip content={<span>{p.attributed_pct.toFixed(2)}% attributed · {gbp(p.unattributed_actual)} unattributed</span>}>
                          <div className="relative h-5 flex items-center">
                            <div className="absolute inset-y-1 left-0 right-0 rounded-[4px] bg-slate-100" />
                            <div className={`relative h-3 rounded-r-[4px] ${p.attributed_pct < 99.99 ? 'bg-amber-500' : 'bg-teal-600'}`} style={{ width: w + '%' }} />
                          </div>
                        </Tip>
                        <span className="text-right text-xs font-mono">{p.attributed_pct.toFixed(1)}% · {gbpShort(p.unattributed_actual)}</span>
                      </button>
                    );
                  })}
                </div>
                <SectionNote>Right column: % attributed · SAP actual left unattributed. Amber bars are below 100%.</SectionNote>
              </Card>
              <Card title="Planned ECC by dimension" subtitle="De-duplicated planned cost from Copperleaf">
                <div className="mb-4">
                  <Tabs
                    tabs={[{ id: 'product', label: 'Product' }, { id: 'intervention_driver', label: 'Driver' }, { id: 'funding_position', label: 'Funding' }, { id: 'area', label: 'Area' }]}
                    activeTab={dim}
                    onChange={(t) => setDim(t.id || t)}
                  />
                </div>
                <BarList
                  items={data.investment_breakdowns[dim].map((b) => ({ ...b, label: b.key }))}
                  valueKey="ecc"
                  sublabel={(b) => `${b.count} investments · attributed actual ${gbpShort(b.attributed)}`}
                />
              </Card>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                Only submissions with data issues
              </label>
              <span className="text-xs text-slate-500">{subs.length} of {data.submissions.length} submissions</span>
            </div>

            <Card className="!p-0 overflow-hidden">
              <div className="hidden lg:grid grid-cols-[1.5rem_minmax(0,1.6fr)_minmax(0,1.4fr)_1fr_1fr_7rem_minmax(0,1.2fr)] gap-4 px-6 py-3 border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <span />
                <span>Submission</span>
                <span>Product / driver</span>
                <span className="text-right">Planned ECC</span>
                <span className="text-right">Attributed actual</span>
                <span className="text-right">Spend / plan</span>
                <span>Flags</span>
              </div>
              {subs.map((x) => {
                const isOpen = open.has(x.submission_id);
                return (
                  <div key={x.submission_id} className="border-b border-slate-100 last:border-0">
                    <button
                      onClick={() => toggle(x.submission_id)}
                      className="w-full text-left grid grid-cols-[1.5rem_1fr] lg:grid-cols-[1.5rem_minmax(0,1.6fr)_minmax(0,1.4fr)_1fr_1fr_7rem_minmax(0,1.2fr)] gap-x-4 gap-y-1 px-4 sm:px-6 py-3 hover:bg-slate-50 items-center"
                    >
                      {isOpen ? <IconChevronDown className="h-4 w-4 text-slate-500" /> : <IconChevronRight className="h-4 w-4 text-slate-500" />}
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">{x.submission_id}</div>
                        <div className="text-xs text-slate-500">{x.investment_count} investments · {x.sap_projects.join(', ') || 'no SAP project'}</div>
                      </div>
                      <div className="col-start-2 lg:col-start-auto text-xs text-slate-700 min-w-0 truncate">{x.products.join(', ')}<span className="text-slate-500"> · {x.drivers.join(', ') || x.funding_positions.join(', ')}</span></div>
                      <div className="col-start-2 lg:col-start-auto lg:text-right"><Money value={x.ecc} short className="text-sm font-bold" /></div>
                      <div className="col-start-2 lg:col-start-auto lg:text-right">{x.attributed_actual ? <Money value={x.attributed_actual} short className="text-sm" /> : <span className="text-xs text-slate-400">—</span>}</div>
                      <div className="col-start-2 lg:col-start-auto lg:text-right text-xs font-mono">{x.spend_to_plan === null ? '—' : pct(x.spend_to_plan)}</div>
                      <div className="col-start-2 lg:col-start-auto flex flex-wrap gap-1">
                        {x.quarantined.length > 0 && <FlagChip tone="rose">quarantined ECC</FlagChip>}
                        {x.duplicate_exposure > 0 && <FlagChip>dup {gbpShort(x.duplicate_exposure)}</FlagChip>}
                        {x.price_bases.length > 1 && <FlagChip tone="slate">mixed price base</FlagChip>}
                        {!x.sap_projects.length && <FlagChip>no SAP link</FlagChip>}
                      </div>
                    </button>
                    {isOpen && <SubmissionDetail sub={x} investments={data.investments} projects={data.projects} onNavigate={onNavigate} />}
                  </div>
                );
              })}
            </Card>
            <SectionNote>
              Copperleaf repeats a submission's ECC on each of its investment rows. It is counted once per submission ("ECC counted"),
              which removes {gbp(s.planned_ecc_naive - s.planned_ecc)} of double counting (SUP-006). Spend / plan compares attributed SAP YTD with the submission's planned ECC.
            </SectionNote>
          </div>
        );
      }}
    </LoadState>
  );
}
