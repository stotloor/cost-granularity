import React, { useState, useEffect, useMemo } from 'react';
import { PageContainer, PageHeader, Card, Button, StatusBadge, FilterBar, ProgressBar } from '../components/ui.jsx';
import { IconCheck, IconAlertTriangle, IconArrowRight, IconChevronRight } from '../components/icons.jsx';
import { api } from '../lib/apexApi.js';

const SYSTEM_COLORS = {
  COUPA: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', label: 'COUPA' },
  FastDraft: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'FastDraft' },
  SAP: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'SAP S/4' }
};

function SystemBadge({ system }) {
  const colors = SYSTEM_COLORS[system] || SYSTEM_COLORS.COUPA;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${colors.bg} ${colors.text} border ${colors.border}`}>
      {colors.label}
    </span>
  );
}

function ConfidenceMeter({ score }) {
  const pct = Math.round(score);
  const color = pct >= 95 ? 'emerald' : pct >= 85 ? 'blue' : pct >= 70 ? 'amber' : 'rose';
  const colorClasses = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500'
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-700">Match Confidence</span>
        <span className={`font-bold ${color === 'emerald' ? 'text-emerald-600' : color === 'blue' ? 'text-blue-600' : color === 'amber' ? 'text-amber-600' : 'text-rose-600'}`}>
          {pct}%
        </span>
      </div>
      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
        <div
          className={`h-full transition-all duration-500 ${colorClasses[color]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function RecordCard({ title, data, system, highlight = false }) {
  return (
    <div className={`rounded-xl border-2 p-5 space-y-4 transition-all ${
      highlight
        ? 'bg-teal-50/50 border-teal-200 shadow-md'
        : 'bg-white border-slate-200 hover:border-slate-300'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="text-sm font-bold text-slate-900 mb-1">{title}</h3>
          <SystemBadge system={system} />
        </div>
      </div>

      <div className="space-y-3 text-xs">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="flex items-start justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
            <span className="font-semibold text-slate-600 uppercase tracking-wide text-[10px]">{key}</span>
            <span className="font-mono text-slate-900 font-medium text-right">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RequirementChip({ id, title }) {
  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-[10px] font-bold text-teal-700 cursor-help"
      title={title}
    >
      <IconCheck className="w-3 h-3" />
      {id}
    </div>
  );
}

export default function ReconciliationMatcher() {
  const [poLines, setPoLines] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [filter, setFilter] = useState('unmatched');
  const [actionFeedback, setActionFeedback] = useState(null);

  useEffect(() => {
    Promise.all([
      api.list('POLine'),
      api.list('SupplierSchedule')
    ]).then(([lines, sched]) => {
      setPoLines(lines.length > 0 ? lines : [
        {
          id: 'POL-5001-01',
          po_id: 'PO-5001',
          line_number: 10,
          description: 'Water main rehabilitation - design, materials and installation',
          quantity: 1,
          unit_price: 285000,
          line_total: 285000,
          wbs_element: 'WBS-PRJ001-01',
          activity_type: 'Pipe Laying'
        },
        {
          id: 'POL-5001-02',
          po_id: 'PO-5001',
          line_number: 20,
          description: 'Site restoration and reinstatement works',
          quantity: 1,
          unit_price: 200000,
          line_total: 200000,
          wbs_element: 'WBS-PRJ001-02',
          activity_type: 'Site Restoration'
        },
        {
          id: 'POL-5002-01',
          po_id: 'PO-5002',
          line_number: 10,
          description: 'Trunk main replacement programme - Phase 1',
          quantity: 1,
          unit_price: 380000,
          line_total: 380000,
          wbs_element: 'WBS-PRJ001-03',
          activity_type: 'Pipe Laying'
        },
        {
          id: 'POL-5003-01',
          po_id: 'PO-5003',
          line_number: 10,
          description: 'Wastewater treatment works upgrade - civils and MEP',
          quantity: 1,
          unit_price: 1250000,
          line_total: 1250000,
          wbs_element: 'WBS-PRJ002-01',
          activity_type: 'Civil Works'
        },
        {
          id: 'POL-5004-01',
          po_id: 'PO-5004',
          line_number: 10,
          description: 'Smart meter installation programme',
          quantity: 1,
          unit_price: 340000,
          line_total: 340000,
          wbs_element: 'WBS-PRJ003-01',
          activity_type: 'Meter Installation'
        }
      ]);
      setSchedules(sched.length > 0 ? sched : [
        {
          id: 'SS-2026-01',
          po_id: 'PO-5001',
          submission_date: '2026-02-28',
          period: '2026-02',
          total_submitted: 161850,
          validation_status: 'approved',
          source: 'FastDraft',
          wbs_element: 'WBS-PRJ001-01',
          activity_type: 'Pipe Laying',
          line_amount: 285000
        },
        {
          id: 'SS-2026-02',
          po_id: 'PO-5002',
          submission_date: '2026-03-15',
          period: '2026-03',
          total_submitted: 380000,
          validation_status: 'approved',
          source: 'FastDraft',
          wbs_element: 'WBS-PRJ001-03',
          activity_type: 'Pipe Laying',
          line_amount: 380000
        },
        {
          id: 'SS-2026-03',
          po_id: 'PO-5003',
          submission_date: '2026-03-20',
          period: '2026-03',
          total_submitted: 1250000,
          validation_status: 'pending',
          source: 'FastDraft',
          wbs_element: 'WBS-PRJ002-01',
          activity_type: 'Civil Works',
          line_amount: 1250000
        }
      ]);
    });
  }, []);

  const matchedPairs = useMemo(() => {
    return poLines.map((line, idx) => {
      const schedule = schedules.find(s => s.wbs_element === line.wbs_element && s.activity_type === line.activity_type);
      const amountMatch = schedule ? Math.abs(line.line_total - (schedule.line_amount ?? schedule.total_submitted)) < 0.01 : false;
      const confidence = schedule && amountMatch ? 98 : schedule ? 85 : 0;
      const status = confidence >= 95 ? 'reconciled' : confidence >= 70 ? 'low_confidence' : 'unmatched';

      const sapTransaction = schedule ? {
        id: `TXN-SAP-${8471 + idx}`,
        posted_date: schedule.submission_date,
        wbs_element: line.wbs_element,
        cost_element: '400100',
        amount: line.line_total,
        status: confidence >= 95 ? 'Reconciled' : 'Pending'
      } : null;

      return { line, schedule, sapTransaction, confidence, status };
    });
  }, [poLines, schedules]);

  const filteredPairs = useMemo(() => {
    if (filter === 'unmatched') return matchedPairs.filter(p => p.status === 'unmatched');
    if (filter === 'low_confidence') return matchedPairs.filter(p => p.status === 'low_confidence');
    if (filter === 'manual_review') return matchedPairs.filter(p => p.status === 'low_confidence' || p.status === 'unmatched');
    return matchedPairs;
  }, [matchedPairs, filter]);

  const currentPair = filteredPairs[currentIndex] || matchedPairs[0];

  const handleAccept = () => {
    setActionFeedback({ type: 'success', message: 'Match accepted and posted to reconciliation ledger' });
    setTimeout(() => {
      setActionFeedback(null);
      if (currentIndex < filteredPairs.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        setCurrentIndex(0);
      }
    }, 1500);
  };

  const handleOverride = () => {
    setActionFeedback({ type: 'warning', message: 'Override initiated — select new match parameters' });
    setTimeout(() => setActionFeedback(null), 2000);
  };

  const handleFlag = () => {
    setActionFeedback({ type: 'error', message: 'Exception flagged for manual review' });
    setTimeout(() => setActionFeedback(null), 2000);
  };

  const handleNext = () => {
    if (currentIndex < filteredPairs.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  const statsData = useMemo(() => {
    const total = matchedPairs.length;
    const reconciled = matchedPairs.filter(p => p.status === 'reconciled').length;
    const pending = matchedPairs.filter(p => p.status === 'low_confidence' || p.status === 'unmatched').length;
    return { total, reconciled, pending };
  }, [matchedPairs]);

  if (!currentPair) {
    return (
      <PageContainer>
        <PageHeader
          eyebrow="Multi-System Reconciliation"
          title="Cost Reconciliation Matcher"
          subtitle="Match purchase order lines, supplier schedules, and financial postings across SAP S/4HANA, COUPA, and FastDraft"
        />
        <Card title="No Matches Available">
          <p className="text-sm text-slate-600">All records have been reconciled or no data is available.</p>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Multi-System Reconciliation"
        title="Cost Reconciliation Matcher"
        subtitle="Match purchase order lines, supplier schedules, and financial postings across SAP S/4HANA, COUPA, and FastDraft"
      />

      {}
      <div className="flex flex-wrap gap-2 items-center pb-4">
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Requirements Demonstrated:</span>
        <RequirementChip
          id="G2"
          title="Separate the three grains: Commercial approval grain, financial posting grain and analytical reporting grain may differ. Their relationships must be explicit, controlled and auditable."
        />
      </div>

      {}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Total Records</div>
          <div className="text-2xl font-bold text-slate-900">{statsData.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Reconciled</div>
          <div className="text-2xl font-bold text-emerald-600">{statsData.reconciled}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Pending Review</div>
          <div className="text-2xl font-bold text-amber-600">{statsData.pending}</div>
        </Card>
      </div>

      {}
      <FilterBar
        filters={[
          { id: 'all', label: 'All Records', count: matchedPairs.length },
          { id: 'unmatched', label: 'Unmatched', count: matchedPairs.filter(p => p.status === 'unmatched').length },
          { id: 'low_confidence', label: 'Low Confidence', count: matchedPairs.filter(p => p.status === 'low_confidence').length },
          { id: 'manual_review', label: 'Manual Review Required', count: matchedPairs.filter(p => p.status === 'low_confidence' || p.status === 'unmatched').length }
        ]}
        activeFilter={filter}
        onFilterChange={setFilter}
      />

      {}
      {actionFeedback && (
        <div className={`p-4 rounded-xl border-2 mb-6 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200 ${
          actionFeedback.type === 'success'
            ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
            : actionFeedback.type === 'warning'
            ? 'bg-amber-50 border-amber-500 text-amber-800'
            : 'bg-rose-50 border-rose-500 text-rose-800'
        }`}>
          <IconCheck className="w-5 h-5" />
          <span className="text-sm font-semibold">{actionFeedback.message}</span>
        </div>
      )}

      {}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {}
        <RecordCard
          title="Purchase Order Line"
          system="COUPA"
          data={{
            'PO Line ID': currentPair.line.id,
            'PO Number': currentPair.line.po_id,
            'Line Number': currentPair.line.line_number,
            'WBS Element': currentPair.line.wbs_element,
            'Activity Type': currentPair.line.activity_type || '—',
            'Description': String(currentPair.line.description ?? '').substring(0, 40) + '...' || '—',
            'Line Total': `£${(currentPair.line.line_total ?? 0).toLocaleString()}`
          }}
        />

        {}
        <div className="space-y-4">
          <RecordCard
            title="Supplier Schedule Line"
            system="FastDraft"
            highlight={currentPair.schedule !== null}
            data={currentPair.schedule ? {
              'Schedule ID': currentPair.schedule.id,
              'Submission Date': currentPair.schedule.submission_date,
              'Period': currentPair.schedule.period,
              'WBS Element': currentPair.schedule.wbs_element,
              'Activity Type': currentPair.schedule.activity_type || '—',
              'Amount': `£${(currentPair.schedule.line_amount ?? currentPair.schedule.total_submitted ?? 0).toLocaleString()}`,
              'Status': currentPair.schedule.validation_status
            } : {
              'Status': 'No matching schedule found'
            }}
          />

          <Card className="p-5">
            <ConfidenceMeter score={currentPair.confidence} />
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-slate-700">Match Status</span>
                <StatusBadge
                  status={currentPair.status === 'reconciled' ? 'Completed' : currentPair.status === 'low_confidence' ? 'Pending Review' : 'Critical'}
                />
              </div>
              <div className="text-[10px] text-slate-500 space-y-1">
                <div className="flex items-center gap-2">
                  {currentPair.schedule && Math.abs(currentPair.line.line_total - (currentPair.schedule.line_amount ?? currentPair.schedule.total_submitted)) < 0.01 ? (
                    <IconCheck className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <IconAlertTriangle className="w-3 h-3 text-amber-500" />
                  )}
                  <span>Amount Match: {currentPair.schedule && Math.abs(currentPair.line.line_total - (currentPair.schedule.line_amount ?? currentPair.schedule.total_submitted)) < 0.01 ? 'Exact' : 'Variance detected'}</span>
                </div>
                <div className="flex items-center gap-2">
                  {currentPair.schedule && currentPair.schedule.wbs_element === currentPair.line.wbs_element ? (
                    <IconCheck className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <IconAlertTriangle className="w-3 h-3 text-amber-500" />
                  )}
                  <span>WBS Match: {currentPair.schedule && currentPair.schedule.wbs_element === currentPair.line.wbs_element ? 'Aligned' : 'Mismatch'}</span>
                </div>
                <div className="flex items-center gap-2">
                  {currentPair.schedule && currentPair.schedule.activity_type === currentPair.line.activity_type ? (
                    <IconCheck className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <IconAlertTriangle className="w-3 h-3 text-amber-500" />
                  )}
                  <span>Activity Match: {currentPair.schedule && currentPair.schedule.activity_type === currentPair.line.activity_type ? 'Aligned' : 'Mismatch'}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {}
        <RecordCard
          title="Financial Transaction (SAP S/4)"
          system="SAP"
          data={currentPair.sapTransaction ? {
            'Transaction ID': currentPair.sapTransaction.id,
            'Posted Date': currentPair.sapTransaction.posted_date,
            'WBS Element': currentPair.sapTransaction.wbs_element,
            'Cost Element': currentPair.sapTransaction.cost_element,
            'Amount': `£${(currentPair.sapTransaction.amount ?? 0).toLocaleString()}`,
            'Posting Status': currentPair.sapTransaction.status
          } : {
            'Status': 'Awaiting reconciliation'
          }}
        />
      </div>

      {}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm text-slate-700">
            <span className="font-semibold">Record {currentIndex + 1} of {filteredPairs.length}</span>
            <span className="text-slate-400">|</span>
            <span className="text-xs text-slate-500">Filter: <span className="font-semibold text-slate-700">{filter.replace('_', ' ')}</span></span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="md"
              icon={IconCheck}
              onClick={handleAccept}
              disabled={currentPair.confidence < 70}
              className="bg-teal-600 hover:bg-teal-500"
            >
              Accept Match
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={handleOverride}
              className="border-amber-500 text-amber-700 hover:bg-amber-50"
            >
              Override & Remap
            </Button>
            <Button
              variant="outline"
              size="md"
              icon={IconAlertTriangle}
              onClick={handleFlag}
              className="border-rose-500 text-rose-700 hover:bg-rose-50"
            >
              Flag Exception
            </Button>
            <Button
              variant="secondary"
              size="md"
              icon={IconChevronRight}
              onClick={handleNext}
            >
              Next Unmatched
            </Button>
          </div>
        </div>
      </Card>

      {}
      <Card title="Three-Grain Reconciliation Model" className="mt-6">
        <div className="space-y-4 text-sm text-slate-700">
          <div className="flex items-start gap-3">
            <SystemBadge system="COUPA" />
            <div className="flex-1">
              <div className="font-semibold text-slate-900 mb-1">Commercial Approval Grain (Purchase Order Line)</div>
              <p className="text-xs text-slate-600">The authoritative contract-level commitment approved by procurement. Single line per deliverable scope. Does NOT require artificial line-item proliferation for analytical detail.</p>
            </div>
          </div>
          <IconArrowRight className="w-5 h-5 text-slate-400 mx-auto" />
          <div className="flex items-start gap-3">
            <SystemBadge system="FastDraft" />
            <div className="flex-1">
              <div className="font-semibold text-slate-900 mb-1">Supplier Schedule Grain (Monthly Submission)</div>
              <p className="text-xs text-slate-600">Supplier-declared monthly progress and cost claims mapped to WBS + Activity. Reconciled against PO commitment. Provides period-level granularity for cash flow forecasting.</p>
            </div>
          </div>
          <IconArrowRight className="w-5 h-5 text-slate-400 mx-auto" />
          <div className="flex items-start gap-3">
            <SystemBadge system="SAP" />
            <div className="flex-1">
              <div className="font-semibold text-slate-900 mb-1">Financial Posting Grain (WBS + Cost Element)</div>
              <p className="text-xs text-slate-600">Governed allocation to WBS and Cost Element for regulatory investment traceability and project cost control. Derived from approved supplier schedules, NOT from PO line splits.</p>
            </div>
          </div>
        </div>
      </Card>
    </PageContainer>
  );
}
