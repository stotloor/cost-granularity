import React from 'react';
import { PageHeader, Card } from '../components/ui.jsx';
import { LoadState, CheckBadge, Kpi, SectionNote, FlagChip } from '../components/insightsUi.jsx';
import { useInsights, gbp } from '../lib/insights.js';

function fmt(v, isCount) {
  if (v === null || v === undefined) return '—';
  if (typeof v !== 'number') return String(v);
  return isCount ? v.toLocaleString('en-GB') : gbp(v);
}

const COUNT_CHECK = /rows|present|flag|rejected|Every PO|recalculate|arithmetic|found/i;

export default function DataQuality() {
  const state = useInsights();
  return (
    <LoadState state={state}>
      {(data) => {
        const s = data.summary;
        const groups = [...new Set(data.checks.map((c) => c.group))];
        const quarantine = data.investments.filter((i) => i.ecc_status === 'invalid' || i.ecc_status === 'text' || i.link_status === 'invalid reference');
        return (
          <div className="space-y-6">
            <PageHeader
              eyebrow="Interface validation (INT-004, INT-005)"
              title="Data Quality"
              subtitle="The workbook is the input contract: its sheets and columns are checked on every load, then record and value control totals are reconciled across sheets and grains."
            />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Kpi label="Source" value={<span className="text-base">{data.meta.source}</span>} sub={`modified ${new Date(data.meta.modified).toLocaleString('en-GB')}`} />
              <Kpi label="Control checks passed" value={`${s.checks_total - s.checks_failed - s.checks_warn} / ${s.checks_total}`} sub={`${s.checks_failed} fail · ${s.checks_warn} warn`} tone={s.checks_failed ? 'bad' : undefined} />
              <Kpi label="Records loaded" value={data.meta.sheets.reduce((a, x) => a + x.records, 0)} sub={`${data.meta.sheets.length} sheets, columns validated`} />
              <Kpi label="Records quarantined / flagged" value={quarantine.length} sub="Copperleaf values and references" tone={quarantine.length ? 'warn' : undefined} />
            </div>

            <Card title="Input contract" subtitle="Sheets and header rows must match exactly; a changed, added or moved column stops the load with the differences listed">
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <tr><th className="px-3 py-2 pl-6">Sheet</th><th className="px-3 py-2">Role</th><th className="px-3 py-2 text-right">Header row</th><th className="px-3 py-2 text-right">Columns</th><th className="px-3 py-2 text-right">Records</th><th className="px-3 py-2">Contract</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.meta.sheets.map((sh) => (
                      <tr key={sh.name}>
                        <td className="px-3 py-2 pl-6 text-xs font-bold">{sh.name}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">{{
                          'SAP Data': 'SAP S/4 posted actuals (posting grain)',
                          SAPPivot: 'Control total for SAP Data',
                          'Copperleaf Data': 'Regulatory investments and planned cost',
                          CopperPivot: 'Control total for Copperleaf',
                          'PO Summary': 'Summary POs (commercial grain)',
                          'Actual Allocation': 'PO → project / WBS split (analytical grain)',
                        }[sh.name]}</td>
                        <td className="px-3 py-2 text-right text-xs font-mono">{sh.header_row}</td>
                        <td className="px-3 py-2 text-right text-xs font-mono">{sh.columns}</td>
                        <td className="px-3 py-2 text-right text-xs font-mono">{sh.records}</td>
                        <td className="px-3 py-2"><CheckBadge status="pass" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {groups.map((g) => (
              <Card key={g} title={`Control totals · ${g}`}>
                <div className="overflow-x-auto -mx-6">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                      <tr><th className="px-3 py-2 pl-6">Check</th><th className="px-3 py-2">Req.</th><th className="px-3 py-2 text-right">Expected</th><th className="px-3 py-2 text-right">Actual</th><th className="px-3 py-2 text-right">Difference</th><th className="px-3 py-2">Status</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.checks.filter((c) => c.group === g).map((c) => {
                        const isCount = COUNT_CHECK.test(c.check);
                        return (
                          <tr key={c.check} className="align-top">
                            <td className="px-3 py-2 pl-6 text-xs">
                              <div className="font-semibold text-slate-900">{c.check}</div>
                              {c.detail && <div className="text-[11px] text-slate-600 max-w-xl">{c.detail}</div>}
                            </td>
                            <td className="px-3 py-2"><FlagChip tone="slate">{c.requirement}</FlagChip></td>
                            <td className="px-3 py-2 text-right text-xs font-mono whitespace-nowrap">{fmt(c.expected, isCount)}</td>
                            <td className="px-3 py-2 text-right text-xs font-mono whitespace-nowrap">{fmt(c.actual, isCount)}</td>
                            <td className={`px-3 py-2 text-right text-xs font-mono whitespace-nowrap ${c.difference ? 'text-rose-700 font-bold' : 'text-slate-400'}`}>{fmt(c.difference, isCount)}</td>
                            <td className="px-3 py-2"><CheckBadge status={c.status} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            ))}

            <Card title="Quarantined and flagged values" subtitle="Copperleaf cells that failed validation; quarantined values are excluded from every total">
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <tr><th className="px-3 py-2 pl-6">Row</th><th className="px-3 py-2">Investment</th><th className="px-3 py-2">Field</th><th className="px-3 py-2">Raw value</th><th className="px-3 py-2">Treatment</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {quarantine.flatMap((i) => {
                      const out = [];
                      if (i.ecc_status === 'invalid' || i.ecc_status === 'text') {
                        out.push(
                          <tr key={i.investment_code + 'ecc'}>
                            <td className="px-3 py-2 pl-6 text-xs font-mono">{i.row}</td>
                            <td className="px-3 py-2 text-xs font-semibold">{i.investment_code}</td>
                            <td className="px-3 py-2 text-xs font-mono">IDTTotalECC</td>
                            <td className="px-3 py-2 text-xs font-mono">{String(i.ecc_raw)}</td>
                            <td className="px-3 py-2 text-xs">
                              {i.ecc_status === 'invalid'
                                ? <><FlagChip tone="rose">quarantined</FlagChip> <span className="text-slate-500">possible recovery {gbp(i.ecc_candidate)} (anonymisation artefact)</span></>
                                : <><FlagChip>accepted</FlagChip> <span className="text-slate-500">parsed as {gbp(i.ecc)}</span></>}
                            </td>
                          </tr>,
                        );
                      }
                      if (i.link_status === 'invalid reference') {
                        out.push(
                          <tr key={i.investment_code + 'link'}>
                            <td className="px-3 py-2 pl-6 text-xs font-mono">{i.row}</td>
                            <td className="px-3 py-2 text-xs font-semibold">{i.investment_code}</td>
                            <td className="px-3 py-2 text-xs font-mono">SAPProject / PercentageOfWBS</td>
                            <td className="px-3 py-2 text-xs font-mono">{String(i.sap_project_raw)} / {String(i.pct_of_wbs)}</td>
                            <td className="px-3 py-2 text-xs"><FlagChip tone="rose">link rejected</FlagChip></td>
                          </tr>,
                        );
                      }
                      return out;
                    })}
                  </tbody>
                </table>
              </div>
              <SectionNote>Row numbers refer to the Copperleaf Data sheet, so every value can be traced to its source cell (G6).</SectionNote>
            </Card>
          </div>
        );
      }}
    </LoadState>
  );
}
