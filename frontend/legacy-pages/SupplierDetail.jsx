import React, { useState, useEffect, useMemo } from 'react';
import { PageContainer, PageHeader, Card, StatusBadge, Button, FilterBar } from '../components/ui.jsx';
import { IconFileText, IconDownload, IconAlertTriangle, IconCheckCircle, IconChevronRight } from '../components/icons.jsx';
import { api } from '../lib/apexApi.js';

function SupplierDetail() {
  const [supplierSchedules, setSupplierSchedules] = useState([]);
  const [scheduleLines, setScheduleLines] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    Promise.all([
      api.list('SupplierSchedule'),
      api.list('SupplierScheduleLine')
    ]).then(([schedules, lines]) => {
      const enrichedSchedules = schedules.length > 0 ? schedules : [
        {
          id: 'SS-2026-01',
          po_id: 'PO-5001',
          submission_date: '2026-02-28',
          period: '2026-02',
          total_submitted: 161850,
          validation_status: 'approved',
          source: 'FastDraft',
          supplier_name: 'AquaTech Engineering Ltd',
          contract_reference: 'CT-2025-WAT-001'
        },
        {
          id: 'SS-2026-02',
          po_id: 'PO-5002',
          submission_date: '2026-03-15',
          period: '2026-03',
          total_submitted: 248000,
          validation_status: 'approved',
          source: 'FastDraft',
          supplier_name: 'Pipeline Solutions UK',
          contract_reference: 'CT-2025-WAT-002'
        },
        {
          id: 'SS-2026-03',
          po_id: 'PO-5003',
          submission_date: '2026-03-20',
          period: '2026-03',
          total_submitted: 625000,
          validation_status: 'pending_review',
          source: 'FastDraft',
          supplier_name: 'Northern Construction Group',
          contract_reference: 'CT-2026-INF-015'
        },
        {
          id: 'SS-2026-04',
          po_id: 'PO-5004',
          submission_date: '2026-03-25',
          period: '2026-03',
          total_submitted: 170000,
          validation_status: 'approved',
          source: 'FastDraft',
          supplier_name: 'Meter Install Services',
          contract_reference: 'CT-2026-MTR-008'
        },
        {
          id: 'SS-2026-05',
          po_id: 'PO-5005',
          submission_date: '2026-04-05',
          period: '2026-04',
          total_submitted: 446000,
          validation_status: 'exception',
          source: 'FastDraft',
          supplier_name: 'WaterWorks Civils Ltd',
          contract_reference: 'CT-2025-WAT-003'
        },
        {
          id: 'SS-2026-06',
          po_id: 'PO-5006',
          submission_date: '2026-04-10',
          period: '2026-04',
          total_submitted: 382500,
          validation_status: 'pending_review',
          source: 'FastDraft',
          supplier_name: 'Thames Engineering Partners',
          contract_reference: 'CT-2026-WW-012'
        },
        {
          id: 'SS-2026-07',
          po_id: 'PO-5001',
          submission_date: '2026-03-31',
          period: '2026-03',
          total_submitted: 142500,
          validation_status: 'approved',
          source: 'FastDraft',
          supplier_name: 'AquaTech Engineering Ltd',
          contract_reference: 'CT-2025-WAT-001'
        },
        {
          id: 'SS-2026-08',
          po_id: 'PO-5002',
          submission_date: '2026-04-15',
          period: '2026-04',
          total_submitted: 186000,
          validation_status: 'approved',
          source: 'FastDraft',
          supplier_name: 'Pipeline Solutions UK',
          contract_reference: 'CT-2025-WAT-002'
        }
      ];
      setSupplierSchedules(enrichedSchedules);
      if (enrichedSchedules.length > 0) {
        setSelectedSchedule(enrichedSchedules[0]);
      }

      const enrichedLines = lines.length > 0 ? lines : [
        {
          id: 'SSL-2026-01-01',
          schedule_id: 'SS-2026-01',
          line_number: 1,
          wbs_element: 'WBS-PRJ001-01',
          site_code: 'SITE-NORTH-01',
          site_name: 'Northfield',
          activity_type: 'Pipe Laying',
          intervention_code: 'INT-SITE-REF-CIVIL',
          quantity: 120,
          unit: 'm³',
          rate: 1200,
          amount: 144000,
          reconciliation_status: 'matched',
          validation_notes: null
        },
        {
          id: 'SSL-2026-01-02',
          schedule_id: 'SS-2026-01',
          line_number: 2,
          wbs_element: 'WBS-PRJ001-02',
          site_code: 'SITE-NORTH-01',
          site_name: 'Northfield',
          activity_type: 'Site Restoration',
          intervention_code: 'INT-SITE-REST-01',
          quantity: 1,
          unit: 'LS',
          rate: 17850,
          amount: 17850,
          reconciliation_status: 'matched',
          validation_notes: null
        },
        {
          id: 'SSL-2026-02-01',
          schedule_id: 'SS-2026-02',
          line_number: 1,
          wbs_element: 'WBS-PRJ001-03',
          site_code: 'SITE-EAST-12',
          site_name: 'Eastbrook',
          activity_type: 'Pipe Laying',
          intervention_code: 'INT-TRUNK-MAIN',
          quantity: 180,
          unit: 'm',
          rate: 1100,
          amount: 198000,
          reconciliation_status: 'matched',
          validation_notes: null
        },
        {
          id: 'SSL-2026-02-02',
          schedule_id: 'SS-2026-02',
          line_number: 2,
          wbs_element: 'WBS-PRJ001-03',
          site_code: 'SITE-EAST-12',
          site_name: 'Eastbrook',
          activity_type: 'Testing & Commissioning',
          intervention_code: 'INT-TEST-COMM',
          quantity: 1,
          unit: 'LS',
          rate: 50000,
          amount: 50000,
          reconciliation_status: 'matched',
          validation_notes: null
        },
        {
          id: 'SSL-2026-03-01',
          schedule_id: 'SS-2026-03',
          line_number: 1,
          wbs_element: 'WBS-PRJ002-01',
          site_code: 'SITE-TREAT-05',
          site_name: 'Riverside Treatment',
          activity_type: 'Civil Works',
          intervention_code: 'INT-WW-UPGRADE',
          quantity: 1,
          unit: 'LS',
          rate: 625000,
          amount: 625000,
          reconciliation_status: 'pending',
          validation_notes: 'Awaiting project milestone confirmation'
        },
        {
          id: 'SSL-2026-04-01',
          schedule_id: 'SS-2026-04',
          line_number: 1,
          wbs_element: 'WBS-PRJ003-01',
          site_code: 'SITE-METRO-20',
          site_name: 'Metro District',
          activity_type: 'Meter Installation',
          intervention_code: 'INT-SMART-MTR',
          quantity: 850,
          unit: 'units',
          rate: 200,
          amount: 170000,
          reconciliation_status: 'matched',
          validation_notes: null
        },
        {
          id: 'SSL-2026-05-01',
          schedule_id: 'SS-2026-05',
          line_number: 1,
          wbs_element: 'WBS-PRJ001-04',
          site_code: 'SITE-SOUTH-08',
          site_name: 'Southgate',
          activity_type: 'Civil Works',
          intervention_code: 'INT-MAIN-REHAB',
          quantity: 220,
          unit: 'm',
          rate: 1800,
          amount: 396000,
          reconciliation_status: 'exception',
          validation_notes: 'Quantity exceeds approved scope by 15%'
        },
        {
          id: 'SSL-2026-05-02',
          schedule_id: 'SS-2026-05',
          line_number: 2,
          wbs_element: 'WBS-PRJ001-04',
          site_code: 'SITE-SOUTH-08',
          site_name: 'Southgate',
          activity_type: 'Site Restoration',
          intervention_code: 'INT-SITE-REST-02',
          quantity: 1,
          unit: 'LS',
          rate: 50000,
          amount: 50000,
          reconciliation_status: 'matched',
          validation_notes: null
        },
        {
          id: 'SSL-2026-06-01',
          schedule_id: 'SS-2026-06',
          line_number: 1,
          wbs_element: 'WBS-PRJ002-02',
          site_code: 'SITE-WEST-15',
          site_name: 'Westfield Station',
          activity_type: 'Civil Works',
          intervention_code: 'INT-PUMP-INSTALL',
          quantity: 1,
          unit: 'LS',
          rate: 382500,
          amount: 382500,
          reconciliation_status: 'pending',
          validation_notes: 'Pending technical specification review'
        },
        {
          id: 'SSL-2026-07-01',
          schedule_id: 'SS-2026-07',
          line_number: 1,
          wbs_element: 'WBS-PRJ001-01',
          site_code: 'SITE-NORTH-01',
          site_name: 'Northfield',
          activity_type: 'Pipe Laying',
          intervention_code: 'INT-SITE-REF-CIVIL',
          quantity: 95,
          unit: 'm³',
          rate: 1200,
          amount: 114000,
          reconciliation_status: 'matched',
          validation_notes: null
        },
        {
          id: 'SSL-2026-07-02',
          schedule_id: 'SS-2026-07',
          line_number: 2,
          wbs_element: 'WBS-PRJ001-02',
          site_code: 'SITE-NORTH-01',
          site_name: 'Northfield',
          activity_type: 'Site Restoration',
          intervention_code: 'INT-SITE-REST-01',
          quantity: 1,
          unit: 'LS',
          rate: 28500,
          amount: 28500,
          reconciliation_status: 'matched',
          validation_notes: null
        },
        {
          id: 'SSL-2026-08-01',
          schedule_id: 'SS-2026-08',
          line_number: 1,
          wbs_element: 'WBS-PRJ001-03',
          site_code: 'SITE-EAST-12',
          site_name: 'Eastbrook',
          activity_type: 'Pipe Laying',
          intervention_code: 'INT-TRUNK-MAIN',
          quantity: 150,
          unit: 'm',
          rate: 1100,
          amount: 165000,
          reconciliation_status: 'matched',
          validation_notes: null
        },
        {
          id: 'SSL-2026-08-02',
          schedule_id: 'SS-2026-08',
          line_number: 2,
          wbs_element: 'WBS-PRJ001-03',
          site_code: 'SITE-EAST-12',
          site_name: 'Eastbrook',
          activity_type: 'Testing & Commissioning',
          intervention_code: 'INT-TEST-COMM',
          quantity: 1,
          unit: 'LS',
          rate: 21000,
          amount: 21000,
          reconciliation_status: 'matched',
          validation_notes: null
        }
      ];
      setScheduleLines(enrichedLines);
    });
  }, []);

  const filteredSchedules = useMemo(() => {
    let result = supplierSchedules;
    if (filterStatus !== 'all') {
      result = result.filter(s => s.validation_status === filterStatus);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(s => 
        (s.supplier_name || '').toLowerCase().includes(term) ||
        (s.contract_reference || '').toLowerCase().includes(term) ||
        (s.period || '').toLowerCase().includes(term)
      );
    }
    return result;
  }, [supplierSchedules, filterStatus, searchTerm]);

  const selectedLines = useMemo(() => {
    if (!selectedSchedule) return [];
    return scheduleLines.filter(l => l.schedule_id === selectedSchedule.id);
  }, [scheduleLines, selectedSchedule]);

  const formatCurrency = (value) => {
    if (value == null) return '£0';
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'approved': { label: 'Approved', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
      'pending_review': { label: 'Pending Review', color: 'bg-amber-50 text-amber-600 border-amber-200' },
      'exception': { label: 'Exception', color: 'bg-rose-50 text-rose-600 border-rose-200' }
    };
    const s = statusMap[status] || { label: status, color: 'bg-slate-100 text-slate-600 border-slate-200' };
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${s.color}`}>
        {s.label}
      </span>
    );
  };

  const getReconciliationBadge = (status) => {
    const statusMap = {
      'matched': { label: 'Matched', color: 'bg-emerald-50 text-emerald-600 border-emerald-200', icon: IconCheckCircle },
      'pending': { label: 'Pending', color: 'bg-amber-50 text-amber-600 border-amber-200', icon: IconAlertTriangle },
      'exception': { label: 'Exception', color: 'bg-rose-50 text-rose-600 border-rose-200', icon: IconAlertTriangle }
    };
    const s = statusMap[status] || { label: status, color: 'bg-slate-100 text-slate-600 border-slate-200', icon: IconFileText };
    const Icon = s.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${s.color}`}>
        <Icon className="w-3.5 h-3.5" />
        {s.label}
      </span>
    );
  };

  const getSourceChip = (source) => {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200">
        {source}
      </span>
    );
  };

  const handleExportSchedule = () => {
    console.log('Exporting schedule:', selectedSchedule?.id);
  };

  const handleFlagIssues = () => {
    console.log('Flagging issues for schedule:', selectedSchedule?.id);
  };

  const statusFilters = [
    { id: 'all', label: 'All Submissions', count: supplierSchedules.length },
    { id: 'approved', label: 'Approved', count: supplierSchedules.filter(s => s.validation_status === 'approved').length },
    { id: 'pending_review', label: 'Pending Review', count: supplierSchedules.filter(s => s.validation_status === 'pending_review').length },
    { id: 'exception', label: 'Exceptions', count: supplierSchedules.filter(s => s.validation_status === 'exception').length }
  ];

  return (
    <PageContainer>
      <div className="space-y-6 sm:space-y-8">
        <PageHeader
          eyebrow="Cost Reconciliation"
          title="Supplier Cost Schedule Submission Detail"
          subtitle="Review and validate supplier-submitted cost schedules against WBS allocations and contract scope"
        />

        <FilterBar
          filters={statusFilters}
          activeFilter={filterStatus}
          onFilterChange={setFilterStatus}
          search={searchTerm}
          onSearch={setSearchTerm}
          searchPlaceholder="Search by supplier, contract, or period..."
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {}
          <div className="lg:col-span-1">
            <Card title="Supplier Submissions" subtitle={`${filteredSchedules.length} submission${filteredSchedules.length === 1 ? '' : 's'} found`}>
              <div className="-mx-6 -mb-6">
                <div className="overflow-auto" style={{ maxHeight: '720px' }}>
                  <div className="divide-y divide-slate-100">
                    {filteredSchedules.map((schedule) => (
                      <button
                        key={schedule.id}
                        onClick={() => setSelectedSchedule(schedule)}
                        className={`w-full text-left px-6 py-4 hover:bg-slate-50/80 transition-colors ${
                          selectedSchedule?.id === schedule.id ? 'bg-teal-50/50 border-l-4 border-teal-500' : ''
                        }`}
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-bold text-slate-900 truncate">
                                {schedule.supplier_name}
                              </h4>
                              <p className="text-xs text-slate-600 font-medium mt-0.5">
                                {schedule.contract_reference}
                              </p>
                            </div>
                            {getStatusBadge(schedule.validation_status)}
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex flex-col gap-1">
                              <span className="text-slate-700 font-semibold">
                                {formatDate(schedule.submission_date)}
                              </span>
                              <span className="text-slate-600">
                                Period: <span className="font-semibold text-slate-800">{schedule.period}</span>
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="text-base font-bold text-slate-900">
                                {formatCurrency(schedule.total_submitted)}
                              </div>
                              {getSourceChip(schedule.source)}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {}
          <div className="lg:col-span-2">
            {selectedSchedule ? (
              <div className="space-y-6">
                {}
                <Card
                  title="Submission Summary"
                  subtitle={`Schedule ID: ${selectedSchedule.id}`}
                  headerAction={
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        icon={IconDownload}
                        onClick={handleExportSchedule}
                      >
                        Export Schedule
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={IconAlertTriangle}
                        onClick={handleFlagIssues}
                      >
                        Flag Issues
                      </Button>
                    </div>
                  }
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Supplier</div>
                      <div className="text-sm font-bold text-slate-900">{selectedSchedule.supplier_name}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Contract Ref</div>
                      <div className="text-sm font-bold text-slate-900">{selectedSchedule.contract_reference}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Submission Date</div>
                      <div className="text-sm font-bold text-slate-900">{formatDate(selectedSchedule.submission_date)}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Period</div>
                      <div className="text-sm font-bold text-slate-900">{selectedSchedule.period}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Total Submitted</div>
                      <div className="text-lg font-bold text-slate-900">{formatCurrency(selectedSchedule.total_submitted)}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Validation Status</div>
                      <div>{getStatusBadge(selectedSchedule.validation_status)}</div>
                    </div>
                  </div>
                </Card>

                {}
                <Card
                  title="Schedule Lines"
                  subtitle={`${selectedLines.length} line item${selectedLines.length === 1 ? '' : 's'} in this submission`}
                >
                  <div className="-mx-6 -mb-6">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="text-left py-3.5 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider">Line#</th>
                            <th className="text-left py-3.5 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider">WBS</th>
                            <th className="text-left py-3.5 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider">Site</th>
                            <th className="text-left py-3.5 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider">Activity Type</th>
                            <th className="text-left py-3.5 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider">Intervention</th>
                            <th className="text-right py-3.5 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider">Qty</th>
                            <th className="text-left py-3.5 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider">Unit</th>
                            <th className="text-right py-3.5 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider">Rate</th>
                            <th className="text-right py-3.5 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider">Amount</th>
                            <th className="text-left py-3.5 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider">Reconciliation</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedLines.map((line, idx) => (
                            <tr key={line.id} className={`${
                              idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                            } hover:bg-slate-50/80 transition-colors`}>
                              <td className="py-3 px-4 text-sm font-semibold text-slate-800">
                                {line.line_number}
                              </td>
                              <td className="py-3 px-4 text-sm font-mono text-slate-800">
                                {line.wbs_element}
                              </td>
                              <td className="py-3 px-4">
                                <div className="text-sm font-semibold text-slate-900">{line.site_name}</div>
                                <div className="text-xs text-slate-600 font-mono">{line.site_code}</div>
                              </td>
                              <td className="py-3 px-4 text-sm text-slate-800">
                                {line.activity_type}
                              </td>
                              <td className="py-3 px-4 text-xs font-mono text-slate-700">
                                {line.intervention_code}
                              </td>
                              <td className="py-3 px-4 text-sm font-semibold text-slate-900 text-right">
                                {line.quantity?.toLocaleString()}
                              </td>
                              <td className="py-3 px-4 text-sm text-slate-700">
                                {line.unit}
                              </td>
                              <td className="py-3 px-4 text-sm font-semibold text-slate-900 text-right">
                                {formatCurrency(line.rate)}
                              </td>
                              <td className="py-3 px-4 text-sm font-bold text-slate-900 text-right">
                                {formatCurrency(line.amount)}
                              </td>
                              <td className="py-3 px-4">
                                {getReconciliationBadge(line.reconciliation_status)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-100 border-t-2 border-slate-300">
                            <td colSpan="8" className="py-3.5 px-4 text-sm font-bold text-slate-900 text-right">
                              Schedule Total:
                            </td>
                            <td className="py-3.5 px-4 text-base font-bold text-slate-900 text-right">
                              {formatCurrency(selectedLines.reduce((sum, l) => sum + (l.amount || 0), 0))}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {selectedLines.some(l => l.validation_notes) && (
                    <div className="mt-4 p-4 rounded-xl bg-amber-50/50 border border-amber-200">
                      <div className="flex items-start gap-3">
                        <IconAlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-amber-900 mb-2">Validation Notes</h4>
                          <ul className="space-y-1.5 text-sm text-amber-800">
                            {selectedLines
                              .filter(l => l.validation_notes)
                              .map(l => (
                                <li key={l.id} className="flex items-start gap-2">
                                  <IconChevronRight className="w-4 h-4 shrink-0 mt-0.5" />
                                  <span>
                                    <span className="font-semibold">Line {l.line_number}:</span> {l.validation_notes}
                                  </span>
                                </li>
                              ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            ) : (
              <Card>
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <IconFileText className="w-16 h-16 text-slate-700 mb-4" />
                  <h3 className="text-lg font-bold text-slate-800 mb-2">No Submission Selected</h3>
                  <p className="text-sm text-slate-600 max-w-md">
                    Select a supplier submission from the list on the left to view detailed schedule lines and reconciliation status.
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

export default SupplierDetail;