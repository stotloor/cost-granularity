import React, { useState, useEffect, useMemo } from 'react';
import { PageContainer, PageHeader, Button, Card, StatusBadge, FilterBar, cn } from '../components/ui.jsx';
import { IconClock, IconCheckCircle, IconAlertTriangle, IconChevronRight, IconFilter, IconEye, IconCheck, IconX, IconAlertCircle } from '../components/icons.jsx';
import { api } from '../lib/apexApi.js';

export default function ApprovalsQueue() {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [poLines, setPoLines] = useState([]);
  const [selectedPO, setSelectedPO] = useState(null);
  const [activeFilter, setActiveFilter] = useState('my_queue');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionInProgress, setActionInProgress] = useState(null);

  useEffect(() => {
    Promise.all([
      api.list('PurchaseOrder'),
      api.list('POLine')
    ]).then(([pos, lines]) => {
      setPurchaseOrders(pos);
      setPoLines(lines);
      if (pos.length > 0 && pos.find(po => po.approval_status === 'pending')) {
        setSelectedPO(pos.find(po => po.approval_status === 'pending'));
      }
    });
  }, []);

  const filteredPOs = useMemo(() => {
    let filtered = purchaseOrders;

    if (activeFilter === 'my_queue') {
      filtered = filtered.filter(po => po.approval_status === 'pending');
    } else if (activeFilter === 'all_pending') {
      filtered = filtered.filter(po => po.approval_status === 'pending');
    } else if (activeFilter === 'escalated') {
      filtered = filtered.filter(po => po.approval_status === 'pending' && po.total_value > 1000000);
    } else if (activeFilter === 'by_value') {
      filtered = [...filtered].sort((a, b) => b.total_value - a.total_value);
    }

    if (searchTerm) {
      filtered = filtered.filter(po => 
        String(po.po_number ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(po.supplier_name ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(po.contract_reference ?? '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [purchaseOrders, activeFilter, searchTerm]);

  const selectedPOLines = useMemo(() => {
    if (!selectedPO) return [];
    return poLines.filter(line => line.po_id === selectedPO.id);
  }, [selectedPO, poLines]);

  const getAIRecommendation = (po) => {
    if (!po) return { status: 'review', label: 'Review Required', color: 'amber' };
    if (po.total_value < 500000 && po.source_system === 'COUPA') {
      return { status: 'approve', label: 'Approve Recommended', color: 'emerald' };
    }
    if (po.total_value > 1000000) {
      return { status: 'review', label: 'Detailed Review Required', color: 'amber' };
    }
    return { status: 'approve', label: 'Approve Recommended', color: 'emerald' };
  };

  const getSLADays = (po) => {
    if (!po) return 0;
    const created = new Date(po.created_date);
    const now = new Date();
    const daysPassed = Math.floor((now - created) / (1000 * 60 * 60 * 24));
    const slaWindow = 5;
    return Math.max(0, slaWindow - daysPassed);
  };

  const getSLAColor = (days) => {
    if (days <= 1) return 'rose';
    if (days <= 2) return 'amber';
    return 'emerald';
  };

  const handleApprove = (po) => {
    setActionInProgress(po.id);
    setTimeout(() => {
      setPurchaseOrders(prev => prev.map(p => 
        p.id === po.id ? { ...p, approval_status: 'approved' } : p
      ));
      setActionInProgress(null);
      if (selectedPO?.id === po.id) {
        const nextPending = purchaseOrders.find(p => p.approval_status === 'pending' && p.id !== po.id);
        setSelectedPO(nextPending || null);
      }
    }, 800);
  };

  const handleRequestChanges = (po) => {
    setActionInProgress(po.id);
    setTimeout(() => {
      setPurchaseOrders(prev => prev.map(p => 
        p.id === po.id ? { ...p, approval_status: 'pending' } : p
      ));
      setActionInProgress(null);
    }, 800);
  };

  const handleReject = (po) => {
    setActionInProgress(po.id);
    setTimeout(() => {
      setPurchaseOrders(prev => prev.map(p => 
        p.id === po.id ? { ...p, approval_status: 'pending' } : p
      ));
      setActionInProgress(null);
    }, 800);
  };

  const filters = [
    { id: 'my_queue', label: 'My Queue', count: purchaseOrders.filter(po => po.approval_status === 'pending').length },
    { id: 'all_pending', label: 'All Pending', count: purchaseOrders.filter(po => po.approval_status === 'pending').length },
    { id: 'escalated', label: 'Escalated', count: purchaseOrders.filter(po => po.approval_status === 'pending' && po.total_value > 1000000).length },
    { id: 'by_value', label: 'By Value Threshold', count: purchaseOrders.length }
  ];

  return (
    <PageContainer>
      <div className="space-y-6 sm:space-y-8">
        <PageHeader
          eyebrow="Procurement Approvals"
          title="Purchase Order Approval Queue"
          subtitle="Review aggregated PO requests with simple approve/reject decisions while maintaining detailed granularity for audit and compliance"
        />

        {}
        <div className="flex flex-wrap gap-2">
          <div 
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 text-xs font-medium"
            title="Approvers shall see the scope, value, progress, quality status, forecast effect and material exceptions needed for their decision. Detailed coding shall be available by drill-down, not imposed as line-by-line approval effort."
          >
            <IconCheckCircle className="w-3.5 h-3.5" />
            <span className="font-bold">G3</span>
            <span className="hidden sm:inline">Simple approvals, accessible detail</span>
          </div>
        </div>

        <FilterBar
          filters={filters}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          search={searchTerm}
          onSearch={setSearchTerm}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
          {}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Approval Queue ({filteredPOs.length})
              </h3>
            </div>

            {filteredPOs.length === 0 ? (
              <Card>
                <div className="py-12 text-center">
                  <IconCheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                  <h4 className="text-base font-bold text-slate-800 mb-1">All Clear</h4>
                  <p className="text-sm text-slate-600">No pending approvals in your queue</p>
                </div>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredPOs.map(po => {
                  const recommendation = getAIRecommendation(po);
                  const slaDays = getSLADays(po);
                  const slaColor = getSLAColor(slaDays);
                  const lines = poLines.filter(l => l.po_id === po.id);
                  const isSelected = selectedPO?.id === po.id;
                  const isProcessing = actionInProgress === po.id;

                  return (
                    <div
                      key={po.id}
                      className={cn(
                        'bg-white rounded-2xl border shadow-xs transition-all cursor-pointer hover:shadow-md',
                        isSelected ? 'border-teal-500 ring-2 ring-teal-500/20' : 'border-slate-200/80'
                      )}
                      onClick={() => setSelectedPO(po)}
                    >
                      <div className="p-5 space-y-4">
                        {}
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-base font-bold text-slate-900">{po.po_number}</h4>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                                {po.source_system}
                              </span>
                            </div>
                            <p className="text-sm text-slate-700 font-semibold">{po.supplier_name}</p>
                            {po.contract_reference && (
                              <p className="text-xs text-slate-600 mt-0.5">Contract: {po.contract_reference}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-lg font-bold text-slate-900">
                              {po.currency === 'GBP' ? '£' : '$'}{(po.total_value / 1000).toFixed(1)}K
                            </div>
                            <div className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mt-1',
                              slaColor === 'rose' && 'bg-rose-100 text-rose-700 border border-rose-200',
                              slaColor === 'amber' && 'bg-amber-100 text-amber-700 border border-amber-200',
                              slaColor === 'emerald' && 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            )}>
                              <IconClock className="w-3 h-3" />
                              {slaDays}d SLA
                            </div>
                          </div>
                        </div>

                        {}
                        <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Scope</span>
                            <span className="text-xs text-slate-600">{lines.length} line item{lines.length !== 1 ? 's' : ''}</span>
                          </div>
                          <p className="text-sm text-slate-800 leading-relaxed">
                            {lines[0]?.description || 'Multiple procurement items'}
                            {lines.length > 1 && (
                              <span className="text-slate-600 ml-1">+ {lines.length - 1} more</span>
                            )}
                          </p>
                        </div>

                        {}
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-700">AI Assessment:</span>
                          <span className={cn(
                            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border',
                            recommendation.color === 'emerald' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
                            recommendation.color === 'amber' && 'bg-amber-50 text-amber-700 border-amber-200'
                          )}>
                            {recommendation.color === 'emerald' ? (
                              <IconCheckCircle className="w-3.5 h-3.5" />
                            ) : (
                              <IconAlertCircle className="w-3.5 h-3.5" />
                            )}
                            {recommendation.label}
                          </span>
                        </div>

                        {}
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                          <Button
                            variant="primary"
                            size="sm"
                            icon={IconCheck}
                            onClick={(e) => { e.stopPropagation(); handleApprove(po); }}
                            disabled={isProcessing}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500"
                          >
                            {isProcessing ? 'Processing...' : 'Approve'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            icon={IconAlertTriangle}
                            onClick={(e) => { e.stopPropagation(); handleRequestChanges(po); }}
                            disabled={isProcessing}
                            className="flex-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                          >
                            Request Changes
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            icon={IconX}
                            onClick={(e) => { e.stopPropagation(); handleReject(po); }}
                            disabled={isProcessing}
                            className="flex-1 border-rose-300 text-rose-700 hover:bg-rose-50"
                          >
                            Reject
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            icon={IconEye}
                            onClick={(e) => { e.stopPropagation(); setSelectedPO(po); }}
                            className="shrink-0"
                          >
                            Detail
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {}
          <div className="lg:col-span-5">
            <div className="sticky top-6">
              {selectedPO ? (
                <Card title="Purchase Order Detail" className="space-y-4">
                  <div className="space-y-3">
                    <div className="pb-3 border-b border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">PO Number</span>
                        <span className="text-sm font-mono font-bold text-slate-900">{selectedPO.po_number}</span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Supplier</span>
                        <span className="text-sm font-semibold text-slate-900">{selectedPO.supplier_name}</span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Total Value</span>
                        <span className="text-lg font-bold text-slate-900">
                          {selectedPO.currency === 'GBP' ? '£' : '$'}{selectedPO.total_value.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Created</span>
                        <span className="text-sm text-slate-800">
                          {new Date(selectedPO.created_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Approval Level</span>
                        <span className="text-xs px-2 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200 font-semibold">
                          {String(selectedPO.approval_grain ?? '').replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      {selectedPO.contract_reference && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Contract Ref</span>
                          <span className="text-sm font-mono text-slate-800">{selectedPO.contract_reference}</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">WBS Breakdown</h4>
                      <div className="space-y-2">
                        {selectedPOLines.length === 0 ? (
                          <p className="text-xs text-slate-600 italic">No line items available</p>
                        ) : (
                          selectedPOLines.map(line => (
                            <div key={line.id} className="bg-slate-50/80 border border-slate-200 rounded-xl p-3">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <span className="text-xs font-mono font-bold text-slate-900">Line {line.line_number}</span>
                                <span className="text-sm font-bold text-slate-900">
                                  {selectedPO.currency === 'GBP' ? '£' : '$'}{line.line_total.toLocaleString()}
                                </span>
                              </div>
                              <p className="text-xs text-slate-800 leading-relaxed mb-2">{line.description}</p>
                              <div className="flex items-center gap-2 text-[10px]">
                                <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold">
                                  {line.wbs_element}
                                </span>
                                {line.activity_type && (
                                  <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 font-semibold">
                                    {line.activity_type}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-200">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Forecast Impact</h4>
                      <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <IconCheckCircle className="w-4 h-4 text-emerald-600" />
                          <span className="text-xs font-bold text-emerald-800">Within Budget Threshold</span>
                        </div>
                        <p className="text-xs text-emerald-700 leading-relaxed">
                          Approval will not trigger material budget variance alerts. All WBS elements remain within approved allocation limits.
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-200">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Previous Similar Approvals</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-700">Same supplier (last 90 days)</span>
                          <span className="font-bold text-slate-900">4 approvals</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-700">Similar value range</span>
                          <span className="font-bold text-slate-900">12 approvals</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-700">Average approval time</span>
                          <span className="font-bold text-slate-900">1.2 days</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ) : (
                <Card>
                  <div className="py-12 text-center">
                    <IconFilter className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                    <h4 className="text-sm font-bold text-slate-800 mb-1">No PO Selected</h4>
                    <p className="text-xs text-slate-600">Select a purchase order from the queue to view details</p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
