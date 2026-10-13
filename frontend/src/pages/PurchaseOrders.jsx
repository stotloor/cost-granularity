import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader, Card } from '../components/ui.jsx';
import { IconChevronDown, IconChevronRight, IconCheckCircle, IconXCircle, IconArrowRight } from '../components/icons.jsx';
import { LoadState, Money, Flags, FlagChip, ConsumptionBar, Kpi, SectionNote, Tip } from '../components/insightsUi.jsx';
import { useInsights, gbp, gbpShort, pct, shortWbs } from '../lib/insights.js';

function Check({ ok, label, detail }) {
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-3 py-2 ${ok ? 'border-emerald-200 bg-emerald-50/60' : 'border-rose-200 bg-rose-50/60'}`}>
      {ok ? <IconCheckCircle className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" /> : <IconXCircle className="h-4 w-4 text-rose-600 mt-0.5 shrink-0" />}
      <div>
        <div className={`text-xs font-bold ${ok ? 'text-emerald-800' : 'text-rose-800'}`}>{label}</div>
        {detail && <div className="text-[11px] text-slate-600">{detail}</div>}
      </div>
    </div>
  );
}

function CoverageCell({ line }) {
  if (line.sap_ytd === null || line.sap_ytd === undefined) return <FlagChip tone="rose">not in SAP</FlagChip>;
  if (line.sap_coverage === null) {
    return <span className="text-xs text-amber-700 font-semibold">SAP ≤ 0</span>;
  }
  const over = line.sap_coverage > 1.0001;
  return (
    <Tip content={<span>All PO allocations on this WBS {gbp(line.sap_total_allocated)} vs SAP YTD {gbp(line.sap_ytd)}</span>}>
      <span className={`text-xs font-mono font-bold ${over ? 'text-rose-700' : 'text-emerald-700'}`}>
        {line.sap_coverage >= 100 ? '>100×' : pct(line.sap_coverage, 0)}
      </span>
    </Tip>
  );
}

function PODetail({ po, onNavigate }) {
  const c = po.checks;
  const ledgerBreaks = po.allocations.filter((l) => l.flags.includes('allocated > SAP posted')).length;
  return (
    <div className="border-t border-slate-100 bg-slate-50/50 px-4 sm:px-6 py-5 space-y-5">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Approver summary</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <Check ok={c.allocation_pct_ok} label={`Allocation totals ${pct(c.allocation_pct_total, 0)}`} detail={`Basis: ${po.allocation_basis}`} />
          <Check ok={c.allocated_matches_posted} label="Allocated = actual posted" detail={`${gbp(c.allocated_total)} of ${gbp(po.actual_posted)}`} />
          <Check ok={c.within_commitment} label="Within committed value" detail={`${gbp(po.remaining_commitment)} remaining`} />
          <Check ok={ledgerBreaks === 0} label={ledgerBreaks ? `${ledgerBreaks} of ${po.wbs_count} WBS exceed SAP actual` : 'Allocations within SAP actual'} detail="GRN-005: schedule must not become a second ledger" />
        </div>
      </div>

      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Split by project</div>
        <div className="flex flex-wrap gap-2">
          {po.projects.map((p) => (
            <button
              key={p.project}
              onClick={() => onNavigate('Projects', p.project)}
              className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 hover:border-teal-300"
            >
              <div className="text-left">
                <div className="text-xs font-bold text-slate-900">{p.project} <span className="font-normal text-slate-500">· {p.project_name}</span></div>
                <div className="text-[11px] text-slate-600">
                  {gbp(p.allocated)} allocated over {p.wbs_count} WBS · SAP project YTD {gbpShort(p.sap_ytd)}
                </div>
              </div>
              <IconArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-teal-600" />
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">WBS allocation (analytical grain)</div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">WBS element</th>
                <th className="px-3 py-2">Project</th>
                <th className="px-3 py-2">Regulatory activity</th>
                <th className="px-3 py-2 text-right">Alloc %</th>
                <th className="px-3 py-2 text-right">Allocated</th>
                <th className="px-3 py-2 text-right">SAP YTD on WBS</th>
                <th className="px-3 py-2 text-right">Alloc / SAP</th>
                <th className="px-3 py-2">Investments</th>
                <th className="px-3 py-2">Review</th>
                <th className="px-3 py-2">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {po.allocations.map((l) => (
                <tr key={l.allocation_id} className="align-top">
                  <td className="px-3 py-2">
                    <div className="font-semibold text-slate-900">{l.wbs_description}</div>
                    <div className="text-[11px] font-mono text-slate-500" title={l.wbs}>{shortWbs(l.wbs)}</div>
                    <div className="text-[11px] text-slate-500">{l.allocation_id} · {l.origin}</div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button onClick={() => onNavigate('Projects', l.project)} className="text-xs font-semibold text-teal-700 hover:underline">{l.project}</button>
                    <div className="text-[11px] text-slate-500">{l.person_responsible || '—'}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-700 max-w-[14rem]">
                    <span className="font-mono font-bold">{l.reg_activity || '—'}</span> {l.reg_activity_description}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{pct(l.allocation_pct, 0)}</td>
                  <td className="px-3 py-2 text-right">
                    <Money value={l.final_allocated} className="text-xs font-bold" />
                    {l.manual_adjustment ? <div className="text-[11px] text-slate-500">adj {gbp(l.manual_adjustment)}</div> : null}
                  </td>
                  <td className="px-3 py-2 text-right">{l.sap_ytd === null ? '—' : <Money value={l.sap_ytd} className="text-xs" />}</td>
                  <td className="px-3 py-2 text-right"><CoverageCell line={l} /></td>
                  <td className="px-3 py-2 text-xs">
                    {l.investments.length ? (
                      <div className="space-y-0.5">
                        {l.investments.map((i) => (
                          <div key={i.investment_code} className="whitespace-nowrap">
                            <button onClick={() => onNavigate('Investments', i.submission_id)} className="font-semibold text-teal-700 hover:underline">{i.investment_code}</button>
                            <span className="text-slate-500"> {i.pct_of_wbs}%</span>
                          </div>
                        ))}
                      </div>
                    ) : <FlagChip>no investment</FlagChip>}
                  </td>
                  <td className="px-3 py-2"><FlagChip tone="slate">{l.review_status}</FlagChip></td>
                  <td className="px-3 py-2 min-w-[10rem]"><Flags flags={l.flags} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <SectionNote>
          "Alloc / SAP" compares all PO allocations landing on a WBS element with that element's SAP YTD actual. Above 100% means the
          allocation schedule claims more cost than SAP has posted (BR-005, GRN-005).
        </SectionNote>
      </div>
    </div>
  );
}

export default function PurchaseOrders({ onNavigate, focus }) {
  const state = useInsights();
  const [open, setOpen] = useState(() => new Set(focus ? [focus] : []));
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (focus) setOpen((s) => new Set([...s, focus]));
  }, [focus]);

  return (
    <LoadState state={state}>
      {(data) => {
        const s = data.summary;
        const q = query.trim().toLowerCase();
        const pos = data.pos.filter((p) => !q || [p.po_number, p.supplier_id, p.contract_ref, p.description,
          ...p.allocations.flatMap((l) => [l.project, l.wbs, l.wbs_description])].some((v) => String(v || '').toLowerCase().includes(q)));
        const toggle = (id) => setOpen((prev) => {
          const n = new Set(prev);
          n.has(id) ? n.delete(id) : n.add(id);
          return n;
        });
        return (
          <div className="space-y-6">
            <PageHeader
              eyebrow="Commercial approval grain"
              title="Purchase Orders"
              subtitle="Each summary PO with its committed value and posted actual. Expand a PO to see how its actual is allocated across projects and WBS elements, and whether that allocation reconciles to SAP."
            />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Kpi label="Committed PO value" value={gbpShort(s.po_value)} sub={`${s.po_count} summary POs`} />
              <Kpi label="Actual posted" value={gbpShort(s.po_actual_posted)} sub={`${pct(s.po_actual_posted / s.po_value, 0)} of commitment`} />
              <Kpi label="Remaining commitment" value={gbpShort(s.po_remaining)} sub="PO value − actual posted" />
              <Kpi label="PO lines → WBS lines" value={`${s.po_count} → ${s.allocation_lines}`} sub="Detail without PO-line proliferation (G4)" />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by PO, supplier, project or WBS…"
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-sm w-full max-w-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button onClick={() => setOpen(new Set(data.pos.map((p) => p.po_number)))} className="text-xs font-semibold text-teal-700 hover:underline">Expand all</button>
              <button onClick={() => setOpen(new Set())} className="text-xs font-semibold text-slate-600 hover:underline">Collapse all</button>
            </div>

            <Card className="!p-0 overflow-hidden">
              <div className="hidden lg:grid grid-cols-[1.5rem_minmax(0,2.2fr)_1fr_1fr_1fr_minmax(0,1.3fr)_7rem] gap-4 px-6 py-3 border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <span />
                <span>Purchase order</span>
                <span className="text-right">PO value</span>
                <span className="text-right">Actual posted</span>
                <span className="text-right">Remaining</span>
                <span>Consumption</span>
                <span className="text-right">Flags</span>
              </div>
              {pos.map((p) => {
                const isOpen = open.has(p.po_number);
                return (
                  <div key={p.po_number} className="border-b border-slate-100 last:border-0">
                    <button
                      onClick={() => toggle(p.po_number)}
                      className="w-full text-left grid grid-cols-[1.5rem_1fr] lg:grid-cols-[1.5rem_minmax(0,2.2fr)_1fr_1fr_1fr_minmax(0,1.3fr)_7rem] gap-x-4 gap-y-2 px-4 sm:px-6 py-4 hover:bg-slate-50 items-center"
                    >
                      {isOpen ? <IconChevronDown className="h-4 w-4 text-slate-500" /> : <IconChevronRight className="h-4 w-4 text-slate-500" />}
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900">{p.po_number} <span className="font-medium text-slate-600">· {p.description}</span></div>
                        <div className="text-xs text-slate-500 truncate">
                          {p.supplier_id} · {p.contract_ref} · {p.po_date} · {p.allocation_basis} · {p.project_count} projects / {p.wbs_count} WBS
                        </div>
                      </div>
                      <div className="col-start-2 lg:col-start-auto flex lg:block justify-between text-right"><span className="lg:hidden text-xs text-slate-500">PO value</span><Money value={p.po_value} className="text-sm font-bold" /></div>
                      <div className="col-start-2 lg:col-start-auto flex lg:block justify-between text-right"><span className="lg:hidden text-xs text-slate-500">Posted</span><Money value={p.actual_posted} className="text-sm" /></div>
                      <div className="col-start-2 lg:col-start-auto flex lg:block justify-between text-right"><span className="lg:hidden text-xs text-slate-500">Remaining</span><Money value={p.remaining_commitment} className="text-sm text-slate-600" /></div>
                      <div className="col-start-2 lg:col-start-auto">
                        <ConsumptionBar posted={p.actual_posted} total={p.po_value} />
                        <div className="text-[11px] text-slate-500 mt-1">{pct(p.consumed_pct, 0)} consumed · {p.status}</div>
                      </div>
                      <div className="col-start-2 lg:col-start-auto flex lg:justify-end gap-1 flex-wrap">
                        {p.flag_count ? <FlagChip tone="rose">{p.flag_count} flags</FlagChip> : <FlagChip tone="teal">clean</FlagChip>}
                        {p.pending_review ? <FlagChip tone="slate">{p.pending_review} to review</FlagChip> : null}
                      </div>
                    </button>
                    {isOpen && <PODetail po={p} onNavigate={onNavigate} />}
                  </div>
                );
              })}
              {pos.length === 0 && <div className="px-6 py-10 text-center text-sm text-slate-500">No purchase orders match the filter.</div>}
            </Card>
          </div>
        );
      }}
    </LoadState>
  );
}
