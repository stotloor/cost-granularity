import React from 'react';
import { PageHeader, Card } from '../components/ui.jsx';
import { IconArrowRight, IconAlertTriangle } from '../components/icons.jsx';
import { LoadState, Kpi, BarList, PeriodBars, SeverityBadge, Money, SectionNote, CheckBadge } from '../components/insightsUi.jsx';
import { useInsights, gbp, gbpShort, pct } from '../lib/insights.js';

function Grain({ eyebrow, title, source, lines, onClick }) {
  return (
    <button onClick={onClick} className="text-left rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-teal-300 transition flex-1 min-w-0">
      <div className="text-[11px] font-bold uppercase tracking-wider text-teal-700">{eyebrow}</div>
      <div className="text-base font-extrabold text-slate-900">{title}</div>
      <div className="text-[11px] text-slate-500 mb-3">{source}</div>
      <dl className="space-y-1">
        {lines.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 text-xs">
            <dt className="text-slate-600">{k}</dt>
            <dd className="font-mono font-bold text-slate-900">{v}</dd>
          </div>
        ))}
      </dl>
    </button>
  );
}

function Link({ ok, label }) {
  return (
    <div className="flex lg:flex-col items-center justify-center gap-1 px-1 py-2 shrink-0">
      <IconArrowRight className={`h-5 w-5 rotate-90 lg:rotate-0 ${ok ? 'text-emerald-600' : 'text-rose-600'}`} />
      <span className={`text-[10px] font-bold text-center max-w-[7rem] ${ok ? 'text-emerald-700' : 'text-rose-700'}`}>{label}</span>
    </div>
  );
}

function findings(data) {
  const s = data.summary;
  const out = [];
  out.push({
    tone: 'bad', page: 'Activities',
    title: `${pct(s.dummy_activity_pct, 0)} of gross SAP actual is on placeholder regulatory activity codes`,
    body: `${gbp(s.dummy_activity_value)} is posted to W99 / QQQ dummy codes, so it cannot be attributed to a regulatory activity (BR-002, ACT-001).`,
  });
  const ledger = data.checks.find((c) => c.requirement === 'GRN-005');
  if (ledger && ledger.status !== 'pass') {
    out.push({
      tone: 'bad', page: 'PurchaseOrders',
      title: `PO allocations claim ${gbpShort(ledger.actual)} more than SAP has posted`,
      body: `${ledger.detail} The allocation schedule is drifting into a second ledger (BR-005, GRN-005).`,
    });
  }
  const pivot = data.checks.find((c) => c.check.startsWith('Copperleaf Σ ECC'));
  if (pivot && pivot.status === 'fail') {
    out.push({
      tone: 'bad', page: 'DataQuality',
      title: `CopperPivot under-reports planned cost by ${gbpShort(Math.abs(pivot.difference))}`,
      body: `${pivot.detail} ${data.investments.filter((i) => i.ecc_status === 'invalid').length} further ECC values are non-numeric and quarantined (${gbpShort(s.planned_ecc_quarantined)} if recovered).`,
    });
  }
  const under = data.projects.filter((p) => p.attributed_pct < 99.99);
  if (under.length) {
    out.push({
      tone: 'warn', page: 'Investments',
      title: `${under.length} of ${data.projects.length} projects are not fully attributed to regulatory investments`,
      body: `${gbp(under.reduce((a, p) => a + p.unattributed_actual, 0))} of SAP actual has no investment; Copperleaf % of WBS sums below 100% (BR-001).`,
    });
  }
  out.push({
    tone: 'good', page: 'PurchaseOrders',
    title: `${s.po_count} summary PO lines carry ${s.allocation_lines} WBS allocations across ${new Set(data.pos.flatMap((p) => p.projects.map((x) => x.project))).size} projects`,
    body: 'Analytical detail is held in the governed allocation schedule, not in PO lines (G4, EFF-003), and every PO reconciles to its schedule (GRN-002).',
  });
  return out;
}

const TONE = {
  bad: 'border-rose-200 bg-rose-50/60',
  warn: 'border-amber-200 bg-amber-50/60',
  good: 'border-emerald-200 bg-emerald-50/60',
};

export default function Dashboard({ onNavigate }) {
  const state = useInsights();
  return (
    <LoadState state={state}>
      {(data) => {
        const s = data.summary;
        const ledger = data.checks.find((c) => c.requirement === 'GRN-005');
        const sev = s.exceptions_by_severity;
        const topExc = data.exceptions.filter((e) => e.severity === 'high').slice(0, 6);
        const projects = [...data.projects].sort((a, b) => Math.abs(b.ytd) - Math.abs(a.ytd));
        const rs = s.requirements_status;
        return (
          <div className="space-y-6">
            <PageHeader
              eyebrow={`Source: ${data.meta.source}`}
              title="Cost Granularity Overview"
              subtitle="Insights from the SAP, Copperleaf and PO allocation data, measured against the Cost Granularity guardrails and mandatory requirements."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {findings(data).map((f) => (
                <button key={f.title} onClick={() => onNavigate(f.page)} className={`text-left rounded-2xl border p-4 hover:shadow-sm transition ${TONE[f.tone]}`}>
                  <div className="text-sm font-bold text-slate-900">{f.title}</div>
                  <div className="text-xs text-slate-700 mt-1">{f.body}</div>
                </button>
              ))}
            </div>

            <Card title="Three grains, connected (G2, GRN-001)" subtitle="Commercial approval → financial posting → analytical reporting, joined by PO number, WBS element and SAP project">
              <div className="flex flex-col lg:flex-row items-stretch gap-1">
                <Grain
                  eyebrow="Commercial approval" title="Purchase orders" source="PO Summary"
                  onClick={() => onNavigate('PurchaseOrders')}
                  lines={[['POs', s.po_count], ['Committed value', gbpShort(s.po_value)], ['Actual posted', gbpShort(s.po_actual_posted)], ['Remaining', gbpShort(s.po_remaining)]]}
                />
                <Link ok={ledger && ledger.status === 'pass'} label={ledger && ledger.status === 'pass' ? 'Allocations within SAP' : 'Allocations exceed SAP'} />
                <Grain
                  eyebrow="Financial posting" title="SAP S/4 actuals" source="SAP Data"
                  onClick={() => onNavigate('Projects')}
                  lines={[['Projects', s.project_count], ['WBS elements', s.wbs_count], ['YTD actual', gbpShort(s.sap_ytd)], ['Credits', gbpShort(s.sap_credits)]]}
                />
                <Link ok={s.attribution_pct > 0.9999} label={`${pct(s.attribution_pct)} attributed`} />
                <Grain
                  eyebrow="Analytical reporting" title="Regulatory investments" source="Copperleaf Data + Actual Allocation"
                  onClick={() => onNavigate('Investments')}
                  lines={[['Investments', s.investment_count], ['Submissions', s.submission_count], ['Planned ECC', gbpShort(s.planned_ecc)], ['Attributed actual', gbpShort(s.attributed_actual)]]}
                />
              </div>
            </Card>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Kpi label="SAP YTD actual" value={gbpShort(s.sap_ytd)} sub={`${s.project_count} projects · ${s.wbs_count} WBS`} />
              <Kpi label="On placeholder codes" value={pct(s.dummy_activity_pct, 0)} sub={`${gbpShort(s.dummy_activity_value)} of gross debits`} tone="bad" />
              <Kpi label="Open exceptions" value={s.exceptions} sub={`${sev.high || 0} high · ${sev.medium || 0} medium`} tone={sev.high ? 'bad' : undefined} />
              <Kpi label="Requirements met" value={`${rs.met} / ${data.requirements.length}`} sub={`${rs.partial} partial · ${rs.gap} gap · ${rs['not evidenced']} not in data`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <Card title="SAP actual by project" subtitle="YTD TOTAL · click to drill into WBS" className="lg:col-span-3">
                <BarList
                  items={projects.map((p) => ({ ...p, label: `${p.project} · ${p.project_name}`, value: p.ytd }))}
                  sublabel={(p) => `${p.person_responsible} · ${p.wbs_count} WBS · ${p.attributed_pct.toFixed(0)}% attributed`}
                  onSelect={(p) => onNavigate('Projects', p.project)}
                />
              </Card>
              <Card title="Portfolio posting-period phasing" subtitle={`Σ SAP period columns, ${s.periods.join(', ')} populated`} className="lg:col-span-2">
                <PeriodBars labels={s.periods} values={s.period_totals} height={170} />
                <SectionNote>Shape of spend only: period columns total {pct(s.period_totals.reduce((a, b) => a + b, 0) / s.sap_ytd, 0)} of YTD TOTAL in this extract.</SectionNote>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <Card
                title="Highest-severity exceptions"
                subtitle="Largest value first"
                className="lg:col-span-3"
                headerAction={<button onClick={() => onNavigate('Exceptions')} className="text-xs font-semibold text-teal-700 hover:underline">All {s.exceptions} →</button>}
              >
                <div className="divide-y divide-slate-100 -my-2">
                  {topExc.map((e) => (
                    <div key={e.id} className="py-2.5 flex items-start gap-3">
                      <IconAlertTriangle className="h-4 w-4 text-rose-600 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-slate-900">{e.title}</div>
                        <div className="text-[11px] text-slate-600 truncate">{e.project || e.entity_id} · {e.owner || 'Unassigned'} · {e.requirement}</div>
                      </div>
                      {e.value !== null && <Money value={e.value} short className="text-xs font-bold" />}
                    </div>
                  ))}
                </div>
              </Card>
              <Card title="Exceptions by severity" className="lg:col-span-2">
                <div className="space-y-3">
                  {['high', 'medium', 'low', 'info'].map((k) => (
                    <button key={k} onClick={() => onNavigate('Exceptions')} className="w-full flex items-center gap-3">
                      <div className="w-20"><SeverityBadge severity={k} /></div>
                      <div className="flex-1 h-3 bg-slate-100 rounded-[4px] overflow-hidden">
                        <div className="h-full bg-slate-500 rounded-r-[4px]" style={{ width: ((sev[k] || 0) / Math.max(1, s.exceptions)) * 100 + '%' }} />
                      </div>
                      <span className="w-8 text-right text-xs font-mono font-bold">{sev[k] || 0}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Data quality</div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <CheckBadge status="pass" /><span className="text-xs font-mono">{s.checks_total - s.checks_failed - s.checks_warn}</span>
                    <CheckBadge status="warn" /><span className="text-xs font-mono">{s.checks_warn}</span>
                    <CheckBadge status="fail" /><span className="text-xs font-mono">{s.checks_failed}</span>
                    <button onClick={() => onNavigate('DataQuality')} className="ml-auto text-xs font-semibold text-teal-700 hover:underline">Control totals →</button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        );
      }}
    </LoadState>
  );
}
