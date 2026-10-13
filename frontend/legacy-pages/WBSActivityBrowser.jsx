import React, { useState, useEffect, useMemo } from 'react';
import { PageContainer, PageHeader, Card, StatusBadge, Button, cn } from '../components/ui.jsx';
import { IconChevronRight, IconChevronDown, IconEdit, IconClock, IconFolder, IconLayers, IconFileText } from '../components/icons.jsx';
import { api } from '../lib/apexApi.js';

function WBSActivityBrowser() {
  const [wbsElements, setWbsElements] = useState([]);
  const [poLines, setPOLines] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [selectedWBS, setSelectedWBS] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState(new Set(['WBS-PRJ001']));

  useEffect(() => {
    Promise.all([
      api.list('POLine').then(setPOLines),
      api.list('PurchaseOrder').then(setPurchaseOrders)
    ]);

    // Rich in-memory WBS structure
    setWbsElements([
      {
        id: 'WBS-PRJ001',
        code: 'WBS-PRJ001',
        description: 'Water Infrastructure Renewal Programme',
        project_id: 'P-2024-INFRA-01',
        project_name: 'London East Water Network Upgrade',
        site: 'Multiple Sites - East London',
        intervention_id: 'INT-WAT-001',
        intervention_name: 'Water Main Rehabilitation',
        investment_ref: 'REG-INV-2024-07',
        status: 'Active',
        parent_id: null,
        level: 0,
        created_date: '2024-01-01',
        total_cost: 2100000,
        activities: [
          { type: 'Civil Works', planned: 850000, actual: 720000 },
          { type: 'Pipe Laying', planned: 680000, actual: 685000 },
          { type: 'Site Restoration', planned: 320000, actual: 290000 },
          { type: 'Testing & Commissioning', planned: 180000, actual: 165000 },
          { type: 'Project Management', planned: 70000, actual: 68000 }
        ]
      },
      {
        id: 'WBS-PRJ001-01',
        code: 'WBS-PRJ001-01',
        description: 'Site Preparation & Civil Works',
        project_id: 'P-2024-INFRA-01',
        project_name: 'London East Water Network Upgrade',
        site: 'Northfield Substation',
        intervention_id: 'INT-SITE-REF-CIVIL',
        intervention_name: 'Site Remediation Civil',
        investment_ref: 'REG-INV-2024-07',
        status: 'Active',
        parent_id: 'WBS-PRJ001',
        level: 1,
        created_date: '2024-01-15',
        total_cost: 850000,
        activities: [
          { type: 'Excavation', planned: 280000, actual: 265000 },
          { type: 'Foundation Works', planned: 320000, actual: 310000 },
          { type: 'Concrete Works', planned: 180000, actual: 175000 },
          { type: 'Safety & Access', planned: 70000, actual: 68000 }
        ]
      },
      {
        id: 'WBS-PRJ001-02',
        code: 'WBS-PRJ001-02',
        description: 'Pipeline Installation',
        project_id: 'P-2024-INFRA-01',
        project_name: 'London East Water Network Upgrade',
        site: 'Multiple Routes - East Zone',
        intervention_id: 'INT-PIPE-INSTALL',
        intervention_name: 'Trunk Main Replacement',
        investment_ref: 'REG-INV-2024-07',
        status: 'Active',
        parent_id: 'WBS-PRJ001',
        level: 1,
        created_date: '2024-02-01',
        total_cost: 680000,
        activities: [
          { type: 'Pipe Laying', planned: 420000, actual: 425000 },
          { type: 'Welding & Jointing', planned: 150000, actual: 148000 },
          { type: 'Pressure Testing', planned: 85000, actual: 87000 },
          { type: 'Quality Inspection', planned: 25000, actual: 25000 }
        ]
      },
      {
        id: 'WBS-PRJ001-03',
        code: 'WBS-PRJ001-03',
        description: 'Site Restoration & Commissioning',
        project_id: 'P-2024-INFRA-01',
        project_name: 'London East Water Network Upgrade',
        site: 'Multiple Sites - East London',
        intervention_id: 'INT-RESTORATION',
        intervention_name: 'Post-Works Restoration',
        investment_ref: 'REG-INV-2024-07',
        status: 'Active',
        parent_id: 'WBS-PRJ001',
        level: 1,
        created_date: '2024-03-10',
        total_cost: 500000,
        activities: [
          { type: 'Site Restoration', planned: 320000, actual: 290000 },
          { type: 'Testing & Commissioning', planned: 180000, actual: 165000 }
        ]
      },
      {
        id: 'WBS-PRJ002',
        code: 'WBS-PRJ002',
        description: 'Wastewater Treatment Works Upgrade',
        project_id: 'P-2026-WW-012',
        project_name: 'Thames Valley Treatment Modernisation',
        site: 'Riverside Treatment Works',
        intervention_id: 'INT-WW-UPGRADE',
        intervention_name: 'Treatment Works MEP Upgrade',
        investment_ref: 'REG-INV-2026-03',
        status: 'Active',
        parent_id: null,
        level: 0,
        created_date: '2026-01-05',
        total_cost: 1250000,
        activities: [
          { type: 'Civil Works', planned: 450000, actual: 0 },
          { type: 'Mechanical Installation', planned: 380000, actual: 0 },
          { type: 'Electrical & Controls', planned: 280000, actual: 0 },
          { type: 'Commissioning', planned: 140000, actual: 0 }
        ]
      },
      {
        id: 'WBS-PRJ003',
        code: 'WBS-PRJ003',
        description: 'Smart Meter Rollout Programme',
        project_id: 'P-2026-MTR-008',
        project_name: 'Customer Metering Modernisation',
        site: 'Regional - All Zones',
        intervention_id: 'INT-METER-ROLLOUT',
        intervention_name: 'Smart Meter Installation',
        investment_ref: 'REG-INV-2026-05',
        status: 'Active',
        parent_id: null,
        level: 0,
        created_date: '2026-02-18',
        total_cost: 340000,
        activities: [
          { type: 'Meter Installation', planned: 280000, actual: 0 },
          { type: 'Data Commissioning', planned: 40000, actual: 0 },
          { type: 'Customer Communication', planned: 20000, actual: 0 }
        ]
      }
    ]);

    // Auto-select first WBS
    setSelectedWBS('WBS-PRJ001-01');
  }, []);

  const toggleNode = (nodeId) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const treeData = useMemo(() => {
    const roots = wbsElements.filter(w => !w.parent_id);
    const buildTree = (parentId, level = 0) => {
      return wbsElements
        .filter(w => w.parent_id === parentId)
        .map(w => ({
          ...w,
          children: buildTree(w.id, level + 1)
        }));
    };
    return roots.map(r => ({
      ...r,
      children: buildTree(r.id, 1)
    }));
  }, [wbsElements]);

  const selectedWBSDetail = useMemo(() => {
    return wbsElements.find(w => w.id === selectedWBS);
  }, [wbsElements, selectedWBS]);

  const renderTreeNode = (node) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = selectedWBS === node.id;
    const variance = node.activities?.reduce((sum, a) => sum + (a.actual - a.planned), 0) || 0;

    return (
      <div key={node.id} className="select-none">
        <div
          onClick={() => setSelectedWBS(node.id)}
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all group',
            isSelected
              ? 'bg-teal-50 border-l-4 border-teal-500 text-slate-900'
              : 'hover:bg-slate-50/80 border-l-4 border-transparent text-slate-800'
          )}
          style={{ paddingLeft: `${node.level * 24 + 16}px` }}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(node.id);
              }}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200 text-slate-600"
            >
              {isExpanded ? <IconChevronDown className="w-4 h-4" /> : <IconChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <div className="w-5" />
          )}

          <IconFolder className="w-5 h-5 text-teal-600 shrink-0" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-slate-900">{node.code}</span>
              <StatusBadge status={node.status === 'Active' ? 'Active' : 'Completed'} size="sm" />
            </div>
            <p className="text-sm text-slate-700 font-medium truncate">{node.description}</p>
          </div>

          <div className="text-right shrink-0">
            <div className="font-mono text-sm font-bold text-slate-900">
              £{(node.total_cost / 1000000).toFixed(2)}M
            </div>
            {variance !== 0 && (
              <div className={cn(
                'text-xs font-semibold',
                variance > 0 ? 'text-rose-600' : 'text-emerald-600'
              )}>
                {variance > 0 ? '+' : ''}£{(variance / 1000).toFixed(0)}k
              </div>
            )}
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="mt-1">
            {node.children.map(child => renderTreeNode(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Project Cost Management"
        title="WBS Structure & Activity Taxonomy Browser"
        subtitle="Navigate work breakdown structures with detailed activity classifications and cost rollups"
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 sm:gap-8">
        {}
        <div className="lg:col-span-2 space-y-4">
          <Card title="WBS Hierarchy" className="h-full">
            <div className="space-y-2 -mx-6 -mb-6">
              <div className="px-6 pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <IconLayers className="w-4 h-4 text-slate-500" />
                  <span className="font-semibold">{wbsElements.length} WBS Elements</span>
                  <span className="text-slate-400">•</span>
                  <span>{treeData.length} Projects</span>
                </div>
              </div>

              <div className="max-h-[calc(100vh-420px)] overflow-y-auto px-6 pb-6 space-y-1">
                {treeData.map(node => renderTreeNode(node))}
              </div>
            </div>
          </Card>
        </div>

        {}
        <div className="lg:col-span-3 space-y-6">
          {selectedWBSDetail ? (
            <>
              {}
              <Card>
                <div className="space-y-5">
                  <div className="flex items-start justify-between">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                          {String(selectedWBSDetail.code ?? '').split('-')[1]?.slice(0, 2) || 'WB'}
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-slate-900">{selectedWBSDetail.code}</h2>
                          <p className="text-sm text-slate-700 font-medium">{selectedWBSDetail.description}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                        <div>
                          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1">Project</span>
                          <button className="text-sm font-semibold text-teal-600 hover:text-teal-700 hover:underline">
                            {selectedWBSDetail.project_name}
                          </button>
                          <div className="text-xs text-slate-600 font-mono mt-0.5">{selectedWBSDetail.project_id}</div>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1">Site Location</span>
                          <div className="text-sm font-medium text-slate-800">{selectedWBSDetail.site}</div>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1">Intervention</span>
                          <button className="text-sm font-semibold text-teal-600 hover:text-teal-700 hover:underline">
                            {selectedWBSDetail.intervention_name}
                          </button>
                          <div className="text-xs text-slate-600 font-mono mt-0.5">{selectedWBSDetail.intervention_id}</div>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1">Investment Ref</span>
                          <button className="text-sm font-semibold text-teal-600 hover:text-teal-700 hover:underline">
                            {selectedWBSDetail.investment_ref}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 pt-4 border-t border-slate-200">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Status:</span>
                          <StatusBadge status={selectedWBSDetail.status === 'Active' ? 'Active' : 'Completed'} />
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <IconClock className="w-4 h-4" />
                          <span className="text-xs font-medium">Created: {new Date(selectedWBSDetail.created_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 ml-6">
                      <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Total Cost</div>
                      <div className="text-3xl font-bold text-slate-900 font-mono">£{(selectedWBSDetail.total_cost / 1000000).toFixed(2)}M</div>
                    </div>
                  </div>
                </div>
              </Card>

              {}
              <Card title="Activity Breakdown & Cost Analysis">
                <div className="-mx-6 -mb-6">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left text-xs font-bold text-slate-700 uppercase tracking-wider py-3.5 px-6">Activity Type</th>
                          <th className="text-right text-xs font-bold text-slate-700 uppercase tracking-wider py-3.5 px-4">Planned £</th>
                          <th className="text-right text-xs font-bold text-slate-700 uppercase tracking-wider py-3.5 px-4">Actual £</th>
                          <th className="text-right text-xs font-bold text-slate-700 uppercase tracking-wider py-3.5 px-6">Variance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedWBSDetail.activities?.map((activity, idx) => {
                          const variance = activity.actual - activity.planned;
                          const variancePct = ((variance / activity.planned) * 100).toFixed(1);
                          return (
                            <tr key={idx} className="bg-white hover:bg-slate-50/80 transition">
                              <td className="py-3.5 px-6">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-teal-500" />
                                  <span className="text-sm font-semibold text-slate-800">{activity.type}</span>
                                </div>
                              </td>
                              <td className="text-right py-3.5 px-4 font-mono text-sm text-slate-700">£{activity.planned.toLocaleString()}</td>
                              <td className="text-right py-3.5 px-4 font-mono text-sm font-bold text-slate-900">£{activity.actual.toLocaleString()}</td>
                              <td className="text-right py-3.5 px-6">
                                <div className="flex items-center justify-end gap-2">
                                  <span className={cn(
                                    'font-mono text-sm font-bold',
                                    variance > 0 ? 'text-rose-600' : variance < 0 ? 'text-emerald-600' : 'text-slate-600'
                                  )}>
                                    {variance > 0 ? '+' : ''}£{variance.toLocaleString()}
                                  </span>
                                  <span className={cn(
                                    'text-xs font-semibold px-2 py-0.5 rounded-full',
                                    variance > 0 ? 'bg-rose-100 text-rose-700' : variance < 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                  )}>
                                    {variance > 0 ? '+' : ''}{variancePct}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50 border-t-2 border-slate-300">
                          <td className="py-3.5 px-6 text-sm font-bold text-slate-900 uppercase tracking-wider">Total</td>
                          <td className="text-right py-3.5 px-4 font-mono text-sm font-bold text-slate-900">
                            £{selectedWBSDetail.activities?.reduce((sum, a) => sum + a.planned, 0).toLocaleString()}
                          </td>
                          <td className="text-right py-3.5 px-4 font-mono text-sm font-bold text-slate-900">
                            £{selectedWBSDetail.activities?.reduce((sum, a) => sum + a.actual, 0).toLocaleString()}
                          </td>
                          <td className="text-right py-3.5 px-6">
                            {(() => {
                              const totalVariance = selectedWBSDetail.activities?.reduce((sum, a) => sum + (a.actual - a.planned), 0) || 0;
                              const totalPlanned = selectedWBSDetail.activities?.reduce((sum, a) => sum + a.planned, 0) || 1;
                              const totalVariancePct = ((totalVariance / totalPlanned) * 100).toFixed(1);
                              return (
                                <div className="flex items-center justify-end gap-2">
                                  <span className={cn(
                                    'font-mono text-sm font-bold',
                                    totalVariance > 0 ? 'text-rose-600' : totalVariance < 0 ? 'text-emerald-600' : 'text-slate-600'
                                  )}>
                                    {totalVariance > 0 ? '+' : ''}£{totalVariance.toLocaleString()}
                                  </span>
                                  <span className={cn(
                                    'text-xs font-semibold px-2 py-0.5 rounded-full',
                                    totalVariance > 0 ? 'bg-rose-100 text-rose-700' : totalVariance < 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                  )}>
                                    {totalVariance > 0 ? '+' : ''}{totalVariancePct}%
                                  </span>
                                </div>
                              );
                            })()}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </Card>

              {}
              <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-200">
                <div className="flex items-center gap-3">
                  <Button variant="primary" icon={IconEdit}>
                    Edit WBS Element
                  </Button>
                  <Button variant="outline" icon={IconFileText}>
                    View Full History
                  </Button>
                </div>
                <Button variant="outline" className="text-slate-600">
                  Close WBS Element
                </Button>
              </div>
            </>
          ) : (
            <Card>
              <div className="text-center py-12 text-slate-500">
                <IconFolder className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                <p className="text-sm font-medium">Select a WBS element from the tree to view details</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

export default WBSActivityBrowser;