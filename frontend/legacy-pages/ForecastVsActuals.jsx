import React, { useState, useEffect, useMemo } from 'react';
import { PageContainer, PageHeader, Card, StatusBadge, Button } from '../components/ui.jsx';
import { IconTrendingUp, IconAlertTriangle, IconCheckCircle, IconArrowRight, IconAlertCircle, IconUser } from '../components/icons.jsx';
import { api } from '../lib/apexApi.js';

// Realistic forecast vs actuals data for demonstration
const generateVarianceData = () => {
  const projects = [
    {
      id: 'PRJ-2024-INFRA-01',
      name: 'WBS-SITE-REF-01 - Site Refurbishment',
      wbs_element: 'WBS-SITE-REF-01',
      manager: 'Sarah Mitchell',
      budget: 2100000,
      forecast: 2000000,
      actual: 1900000,
      status: 'On Track',
      periods: [
        { month: 'Apr-2024', planned: 150000, forecast: 145000, actual: 142000, variance: -8000, reason: 'Material Cost Savings', narrative: 'Negotiated better rates with supplier' },
        { month: 'May-2024', planned: 180000, forecast: 175000, actual: 168000, variance: -12000, reason: 'Labour Efficiency', narrative: 'Works completed ahead of schedule' },
        { month: 'Jun-2024', planned: 200000, forecast: 190000, actual: 185000, variance: -15000, reason: 'Scope Reduction', narrative: 'Some civil works deferred to next phase' },
        { month: 'Jul-2024', planned: 175000, forecast: 170000, actual: 165000, variance: -10000, reason: 'Weather Advantage', narrative: 'Favorable conditions accelerated work' },
        { month: 'Aug-2024', planned: 195000, forecast: 185000, actual: 180000, variance: -15000, reason: 'Material Cost Savings', narrative: 'Bulk purchase discount achieved' },
        { month: 'Sep-2024', planned: 220000, forecast: 210000, actual: 205000, variance: -15000, reason: 'Labour Efficiency', narrative: 'Experienced crew assigned' },
        { month: 'Oct-2024', planned: 185000, forecast: 180000, actual: 175000, variance: -10000, reason: 'Scope Reduction', narrative: 'Civil works completed early' },
        { month: 'Nov-2024', planned: 195000, forecast: 190000, actual: 188000, variance: -7000, reason: 'Process Improvement', narrative: 'Streamlined workflow reduced costs' },
        { month: 'Dec-2024', planned: 200000, forecast: 195000, actual: 192000, variance: -8000, reason: 'Material Cost Savings', narrative: 'Year-end supplier discounts' },
        { month: 'Jan-2025', planned: 180000, forecast: 175000, actual: 170000, variance: -10000, reason: 'Labour Efficiency', narrative: 'Minimal rework required' },
        { month: 'Feb-2025', planned: 120000, forecast: 115000, actual: 110000, variance: -10000, reason: 'Early Completion', narrative: 'Project ahead of schedule' },
        { month: 'Mar-2025', planned: 100000, forecast: 70000, actual: 20000, variance: -80000, reason: 'Phase Complete', narrative: 'Phase completed under budget' }
      ]
    },
    {
      id: 'PRJ-2024-INFRA-02',
      name: 'WBS-PIPE-MAIN-02 - Main Pipeline Upgrade',
      wbs_element: 'WBS-PIPE-MAIN-02',
      manager: 'David Thompson',
      budget: 1850000,
      forecast: 1920000,
      actual: 1980000,
      status: 'Over Budget',
      periods: [
        { month: 'Apr-2024', planned: 140000, forecast: 145000, actual: 148000, variance: 8000, reason: 'Ground Conditions', narrative: 'Unexpected rock formations' },
        { month: 'May-2024', planned: 160000, forecast: 165000, actual: 172000, variance: 12000, reason: 'Material Price Increase', narrative: 'Steel pipe costs rose 8%' },
        { month: 'Jun-2024', planned: 155000, forecast: 160000, actual: 168000, variance: 13000, reason: 'Labour Overrun', narrative: 'Additional specialist crew needed' },
        { month: 'Jul-2024', planned: 165000, forecast: 170000, actual: 178000, variance: 13000, reason: 'Scope Change', narrative: 'Client requested additional capacity' },
        { month: 'Aug-2024', planned: 150000, forecast: 155000, actual: 162000, variance: 12000, reason: 'Weather Delay', narrative: 'Heavy rains delayed excavation' },
        { month: 'Sep-2024', planned: 170000, forecast: 175000, actual: 183000, variance: 13000, reason: 'Remedial Works', narrative: 'Additional groundwork required' },
        { month: 'Oct-2024', planned: 155000, forecast: 160000, actual: 167000, variance: 12000, reason: 'Material Price Increase', narrative: 'Cement costs increased' },
        { month: 'Nov-2024', planned: 145000, forecast: 150000, actual: 158000, variance: 13000, reason: 'Labour Overrun', narrative: 'Overtime required to meet deadline' },
        { month: 'Dec-2024', planned: 160000, forecast: 165000, actual: 172000, variance: 12000, reason: 'Scope Change', narrative: 'Additional testing mandated' },
        { month: 'Jan-2025', planned: 155000, forecast: 160000, actual: 168000, variance: 13000, reason: 'Ground Conditions', narrative: 'Contaminated soil remediation' },
        { month: 'Feb-2025', planned: 140000, forecast: 145000, actual: 152000, variance: 12000, reason: 'Material Price Increase', narrative: 'Final material costs higher' },
        { month: 'Mar-2025', planned: 100000, forecast: 110000, actual: 112000, variance: 12000, reason: 'Commissioning Delays', narrative: 'Extended testing period' }
      ]
    },
    {
      id: 'PRJ-2024-INFRA-03',
      name: 'WBS-TREAT-WW-01 - Wastewater Treatment',
      wbs_element: 'WBS-TREAT-WW-01',
      manager: 'Emma Rodriguez',
      budget: 3200000,
      forecast: 3150000,
      actual: 3120000,
      status: 'At Risk',
      periods: [
        { month: 'Apr-2024', planned: 250000, forecast: 245000, actual: 242000, variance: -8000, reason: 'Procurement Timing', narrative: 'Equipment arrived early, discount secured' },
        { month: 'May-2024', planned: 280000, forecast: 275000, actual: 278000, variance: -2000, reason: 'Mixed Performance', narrative: 'Labour savings offset by material costs' },
        { month: 'Jun-2024', planned: 270000, forecast: 268000, actual: 272000, variance: 2000, reason: 'Design Change', narrative: 'Minor scope adjustment' },
        { month: 'Jul-2024', planned: 265000, forecast: 262000, actual: 265000, variance: 0, reason: 'On Plan', narrative: 'Work proceeding as scheduled' },
        { month: 'Aug-2024', planned: 275000, forecast: 270000, actual: 268000, variance: -7000, reason: 'Efficiency Gains', narrative: 'Modular construction benefits' },
        { month: 'Sep-2024', planned: 290000, forecast: 285000, actual: 283000, variance: -7000, reason: 'Process Improvement', narrative: 'Installation method optimized' },
        { month: 'Oct-2024', planned: 260000, forecast: 258000, actual: 260000, variance: -2000, reason: 'Minor Variance', narrative: 'Within acceptable tolerance' },
        { month: 'Nov-2024', planned: 255000, forecast: 255000, actual: 258000, variance: 3000, reason: 'Quality Requirements', narrative: 'Additional QC inspections' },
        { month: 'Dec-2024', planned: 270000, forecast: 268000, actual: 270000, variance: -2000, reason: 'Seasonal Pricing', narrative: 'Year-end material deals' },
        { month: 'Jan-2025', planned: 285000, forecast: 282000, actual: 280000, variance: -5000, reason: 'Labour Efficiency', narrative: 'Skilled team performance' },
        { month: 'Feb-2025', planned: 300000, forecast: 297000, actual: 294000, variance: -6000, reason: 'Final Optimization', narrative: 'Final phase efficiencies' },
        { month: 'Mar-2025', planned: 200000, forecast: 185000, actual: 150000, variance: -50000, reason: 'Early Close-out', narrative: 'Commissioning completed early' }
      ]
    },
    {
      id: 'PRJ-2024-METER-01',
      name: 'WBS-SMART-MTR-03 - Smart Meter Rollout',
      wbs_element: 'WBS-SMART-MTR-03',
      manager: 'James Patterson',
      budget: 980000,
      forecast: 995000,
      actual: 1020000,
      status: 'At Risk',
      periods: [
        { month: 'Apr-2024', planned: 75000, forecast: 77000, actual: 79000, variance: 4000, reason: 'Access Issues', narrative: 'Customer appointment delays' },
        { month: 'May-2024', planned: 82000, forecast: 84000, actual: 87000, variance: 5000, reason: 'Device Costs', narrative: 'Meter unit price increase' },
        { month: 'Jun-2024', planned: 85000, forecast: 87000, actual: 90000, variance: 5000, reason: 'Labour Rate', narrative: 'Contractor rate adjustment' },
        { month: 'Jul-2024', planned: 80000, forecast: 82000, actual: 85000, variance: 5000, reason: 'Complexity', narrative: 'More difficult installations than expected' },
        { month: 'Aug-2024', planned: 83000, forecast: 85000, actual: 88000, variance: 5000, reason: 'Access Issues', narrative: 'Additional site visits required' },
        { month: 'Sep-2024', planned: 87000, forecast: 89000, actual: 92000, variance: 5000, reason: 'Device Costs', narrative: 'Communication module upgrade' },
        { month: 'Oct-2024', planned: 81000, forecast: 83000, actual: 86000, variance: 5000, reason: 'Labour Rate', narrative: 'Weekend work premium' },
        { month: 'Nov-2024', planned: 78000, forecast: 80000, actual: 83000, variance: 5000, reason: 'Complexity', narrative: 'Legacy system integration' },
        { month: 'Dec-2024', planned: 84000, forecast: 86000, actual: 89000, variance: 5000, reason: 'Access Issues', narrative: 'Holiday period scheduling' },
        { month: 'Jan-2025', planned: 86000, forecast: 88000, actual: 91000, variance: 5000, reason: 'Device Costs', narrative: 'Final batch pricing' },
        { month: 'Feb-2025', planned: 89000, forecast: 91000, actual: 94000, variance: 5000, reason: 'Labour Rate', narrative: 'Final phase contractor costs' },
        { month: 'Mar-2025', planned: 90000, forecast: 93000, actual: 96000, variance: 6000, reason: 'Commissioning', narrative: 'Extended validation period' }
      ]
    },
    {
      id: 'PRJ-2024-NET-EXP-01',
      name: 'WBS-NETWORK-EXP-05 - Distribution Network',
      wbs_element: 'WBS-NETWORK-EXP-05',
      manager: 'Linda Chen',
      budget: 1650000,
      forecast: 1640000,
      actual: 1625000,
      status: 'On Track',
      periods: [
        { month: 'Apr-2024', planned: 130000, forecast: 128000, actual: 126000, variance: -4000, reason: 'Procurement Timing', narrative: 'Early contractor mobilization' },
        { month: 'May-2024', planned: 140000, forecast: 138000, actual: 135000, variance: -5000, reason: 'Material Savings', narrative: 'Bulk pipe purchase discount' },
        { month: 'Jun-2024', planned: 145000, forecast: 143000, actual: 140000, variance: -5000, reason: 'Labour Efficiency', narrative: 'Experienced installation crew' },
        { month: 'Jul-2024', planned: 135000, forecast: 133000, actual: 131000, variance: -4000, reason: 'Weather Advantage', narrative: 'Good working conditions' },
        { month: 'Aug-2024', planned: 138000, forecast: 136000, actual: 134000, variance: -4000, reason: 'Process Improvement', narrative: 'Optimized trenching method' },
        { month: 'Sep-2024', planned: 142000, forecast: 140000, actual: 138000, variance: -4000, reason: 'Material Savings', narrative: 'Alternative material sourcing' },
        { month: 'Oct-2024', planned: 137000, forecast: 135000, actual: 133000, variance: -4000, reason: 'Labour Efficiency', narrative: 'Minimal rework required' },
        { month: 'Nov-2024', planned: 133000, forecast: 131000, actual: 129000, variance: -4000, reason: 'Scope Optimization', narrative: 'Route optimization savings' },
        { month: 'Dec-2024', planned: 140000, forecast: 138000, actual: 136000, variance: -4000, reason: 'Material Savings', narrative: 'Year-end supplier deals' },
        { month: 'Jan-2025', planned: 144000, forecast: 142000, actual: 140000, variance: -4000, reason: 'Labour Efficiency', narrative: 'Strong team performance' },
        { month: 'Feb-2025', planned: 146000, forecast: 144000, actual: 142000, variance: -4000, reason: 'Process Improvement', narrative: 'Refined installation process' },
        { month: 'Mar-2025', planned: 120000, forecast: 112000, actual: 101000, variance: -19000, reason: 'Early Completion', narrative: 'Project finished ahead of schedule' }
      ]
    }
  ];

  return projects.map(p => ({
    ...p,
    variance_amount: p.actual - p.forecast,
    variance_pct: ((p.actual - p.forecast) / p.budget * 100).toFixed(1)
  }));
};

function ForecastVsActuals() {
  const [varianceData, setVarianceData] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate data loading
    setTimeout(() => {
      const data = generateVarianceData();
      setVarianceData(data);
      setSelectedProject(data[0]); // Auto-select first project
      setLoading(false);
    }, 300);
  }, []);

  const sortedProjects = useMemo(() => {
    return [...varianceData].sort((a, b) => Math.abs(b.variance_amount) - Math.abs(a.variance_amount));
  }, [varianceData]);

  const formatCurrency = (value) => {
    if (value === 0) return '£0';
    const absValue = Math.abs(value);
    if (absValue >= 1000000) {
      return `£${(value / 1000000).toFixed(1)}M`;
    }
    if (absValue >= 1000) {
      return `£${(value / 1000).toFixed(0)}K`;
    }
    return `£${value.toLocaleString()}`;
  };

  const getStatusColor = (status) => {
    if (status === 'On Track') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status === 'At Risk') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
  };

  const getVarianceColor = (variance) => {
    if (variance < 0) return 'text-emerald-700';
    if (variance > 0) return 'text-rose-700';
    return 'text-slate-400';
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-96">
          <div className="text-slate-400 text-sm">Loading variance analysis...</div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-6 sm:space-y-8">
        <PageHeader
          eyebrow="Financial Performance"
          title="Forecast vs Actuals Variance Analysis"
          subtitle="Monitor project-level spend variance and drill into period-by-period performance trends"
        />

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 sm:gap-8">
          {}
          <div className="lg:col-span-2 space-y-4">
            <Card title="Project Variance Summary" subtitle="Sorted by absolute variance magnitude">
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="w-full text-left border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-slate-700 font-bold text-xs uppercase tracking-wider py-3.5 px-4 sticky top-0 bg-slate-50">Project / WBS</th>
                      <th className="text-slate-700 font-bold text-xs uppercase tracking-wider py-3.5 px-3 text-right sticky top-0 bg-slate-50">Budget</th>
                      <th className="text-slate-700 font-bold text-xs uppercase tracking-wider py-3.5 px-3 text-right sticky top-0 bg-slate-50">Forecast</th>
                      <th className="text-slate-700 font-bold text-xs uppercase tracking-wider py-3.5 px-3 text-right sticky top-0 bg-slate-50">Actual</th>
                      <th className="text-slate-700 font-bold text-xs uppercase tracking-wider py-3.5 px-3 text-right sticky top-0 bg-slate-50">Variance</th>
                      <th className="text-slate-700 font-bold text-xs uppercase tracking-wider py-3.5 px-3 text-center sticky top-0 bg-slate-50">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedProjects.map((project) => {
                      const isSelected = selectedProject?.id === project.id;
                      return (
                        <tr
                          key={project.id}
                          onClick={() => setSelectedProject(project)}
                          className={`cursor-pointer transition ${
                            isSelected
                              ? 'bg-teal-50/50 hover:bg-teal-50/70 border-l-4 border-l-teal-500'
                              : 'bg-white hover:bg-slate-50/80'
                          }`}
                        >
                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <div className="text-xs font-mono font-bold text-slate-800">{project.wbs_element}</div>
                              <div className="text-xs text-slate-600 truncate max-w-[180px]">{String(project.name ?? '').split(' - ')[1]}</div>
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-xs font-semibold text-slate-700 text-right font-mono">{formatCurrency(project.budget)}</td>
                          <td className="py-3.5 px-3 text-xs font-semibold text-slate-700 text-right font-mono">{formatCurrency(project.forecast)}</td>
                          <td className="py-3.5 px-3 text-xs font-semibold text-slate-800 text-right font-mono">{formatCurrency(project.actual)}</td>
                          <td className="py-3.5 px-3 text-right">
                            <div className="space-y-0.5">
                              <div className={`text-xs font-bold font-mono ${getVarianceColor(project.variance_amount)}`}>
                                {project.variance_amount > 0 ? '+' : ''}{formatCurrency(project.variance_amount)}
                              </div>
                              <div className={`text-[10px] font-semibold ${getVarianceColor(project.variance_amount)}`}>
                                {project.variance_amount > 0 ? '+' : ''}{project.variance_pct}%
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="flex justify-center">
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${getStatusColor(project.status)}`}>
                                {project.status}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {}
          <div className="lg:col-span-3 space-y-6">
            {selectedProject ? (
              <>
                {}
                <Card>
                  <div className="space-y-4">
                    <div className="flex items-start justify-between flex-wrap gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="text-lg font-bold text-slate-900">{selectedProject.wbs_element}</h3>
                          <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border ${getStatusColor(selectedProject.status)}`}>
                            {selectedProject.status}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 font-medium">{String(selectedProject.name ?? '').split(' - ')[1]}</p>
                        <div className="flex items-center gap-4 text-xs text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <IconUser className="w-3.5 h-3.5 text-slate-500" />
                            <span className="font-semibold">Project Manager:</span>
                            <span className="font-medium text-slate-700">{selectedProject.manager}</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-right">
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Budget</div>
                          <div className="text-base font-bold text-slate-900 font-mono">{formatCurrency(selectedProject.budget)}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Forecast</div>
                          <div className="text-base font-bold text-slate-800 font-mono">{formatCurrency(selectedProject.forecast)}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Actual</div>
                          <div className="text-base font-bold text-slate-900 font-mono">{formatCurrency(selectedProject.actual)}</div>
                        </div>
                      </div>
                    </div>

                    {}
                    <div className="pt-4 border-t border-slate-200">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Total Variance (£)</div>
                          <div className={`text-2xl font-extrabold font-mono ${getVarianceColor(selectedProject.variance_amount)}`}>
                            {selectedProject.variance_amount > 0 ? '+' : ''}{formatCurrency(selectedProject.variance_amount)}
                          </div>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Variance (%)</div>
                          <div className={`text-2xl font-extrabold font-mono ${getVarianceColor(selectedProject.variance_amount)}`}>
                            {selectedProject.variance_amount > 0 ? '+' : ''}{selectedProject.variance_pct}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                {}
                <Card title="12-Month Trend Analysis" subtitle="Planned vs Forecast vs Actual spend by period">
                  <div className="space-y-6">
                    {}
                    <div className="w-full" style={{ height: '280px' }}>
                      <svg width="100%" height="100%" viewBox="0 0 800 280" preserveAspectRatio="xMidYMid meet" className="overflow-visible">
                        {}
                        <line x1="60" y1="20" x2="60" y2="220" stroke="#e2e8f0" strokeWidth="1" />
                        <line x1="60" y1="220" x2="780" y2="220" stroke="#e2e8f0" strokeWidth="2" />
                        {[0, 1, 2, 3, 4].map((i) => (
                          <line key={i} x1="60" y1={20 + i * 50} x2="780" y2={20 + i * 50} stroke="#f1f5f9" strokeWidth="1" />
                        ))}

                        {}
                        <text x="50" y="25" textAnchor="end" fontSize="10" fill="#64748b" fontWeight="600">£300K</text>
                        <text x="50" y="75" textAnchor="end" fontSize="10" fill="#64748b" fontWeight="600">£225K</text>
                        <text x="50" y="125" textAnchor="end" fontSize="10" fill="#64748b" fontWeight="600">£150K</text>
                        <text x="50" y="175" textAnchor="end" fontSize="10" fill="#64748b" fontWeight="600">£75K</text>
                        <text x="50" y="225" textAnchor="end" fontSize="10" fill="#64748b" fontWeight="600">£0</text>

                        {}
                        {(() => {
                          const maxValue = Math.max(...selectedProject.periods.map(p => Math.max(p.planned, p.forecast, p.actual)));
                          const xStep = 720 / (selectedProject.periods.length - 1);
                          const yScale = 200 / maxValue;

                          const plannedPath = selectedProject.periods.map((p, i) => {
                            const x = 60 + i * xStep;
                            const y = 220 - p.planned * yScale;
                            return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
                          }).join(' ');

                          const forecastPath = selectedProject.periods.map((p, i) => {
                            const x = 60 + i * xStep;
                            const y = 220 - p.forecast * yScale;
                            return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
                          }).join(' ');

                          const actualPath = selectedProject.periods.map((p, i) => {
                            const x = 60 + i * xStep;
                            const y = 220 - p.actual * yScale;
                            return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
                          }).join(' ');

                          return (
                            <>
                              <path d={plannedPath} fill="none" stroke="#0d9488" strokeWidth="2" strokeDasharray="5,3" opacity="0.5" />
                              <path d={forecastPath} fill="none" stroke="#f59e0b" strokeWidth="2" opacity="0.7" />
                              <path d={actualPath} fill="none" stroke="#0f172a" strokeWidth="3" />

                              {}
                              {selectedProject.periods.map((p, i) => {
                                const x = 60 + i * xStep;
                                const yActual = 220 - p.actual * yScale;
                                return (
                                  <circle key={i} cx={x} cy={yActual} r="4" fill="#0f172a" stroke="white" strokeWidth="2" />
                                );
                              })}
                            </>
                          );
                        })()}

                        {}
                        {selectedProject.periods.map((p, i) => {
                          if (i % 2 === 0) {
                            const x = 60 + i * (720 / (selectedProject.periods.length - 1));
                            return (
                              <text key={i} x={x} y="240" textAnchor="middle" fontSize="9" fill="#64748b" fontWeight="500">
                                {String(p.month ?? '').split('-')[0]}
                              </text>
                            );
                          }
                          return null;
                        })}
                      </svg>
                    </div>

                    {}
                    <div className="flex items-center justify-center gap-6 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-0.5 bg-teal-500 opacity-50" style={{ borderTop: '2px dashed' }} />
                        <span className="text-xs font-semibold text-slate-700">Planned</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-0.5 bg-amber-500 opacity-70" />
                        <span className="text-xs font-semibold text-slate-700">Forecast</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-1 bg-slate-900 rounded-full" />
                        <span className="text-xs font-semibold text-slate-700">Actual</span>
                      </div>
                    </div>
                  </div>
                </Card>

                {}
                <Card title="Period Variance Breakdown" subtitle="Detailed variance analysis with reason codes and narratives">
                  <div className="overflow-x-auto -mx-6 px-6">
                    <table className="w-full text-left border-separate border-spacing-0">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-slate-700 font-bold text-xs uppercase tracking-wider py-3.5 px-4">Period</th>
                          <th className="text-slate-700 font-bold text-xs uppercase tracking-wider py-3.5 px-3 text-right">Planned</th>
                          <th className="text-slate-700 font-bold text-xs uppercase tracking-wider py-3.5 px-3 text-right">Forecast</th>
                          <th className="text-slate-700 font-bold text-xs uppercase tracking-wider py-3.5 px-3 text-right">Actual</th>
                          <th className="text-slate-700 font-bold text-xs uppercase tracking-wider py-3.5 px-3 text-right">Variance</th>
                          <th className="text-slate-700 font-bold text-xs uppercase tracking-wider py-3.5 px-4">Reason Code</th>
                          <th className="text-slate-700 font-bold text-xs uppercase tracking-wider py-3.5 px-4">Narrative</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedProject.periods.map((period, idx) => (
                          <tr key={idx} className="bg-white hover:bg-slate-50/80">
                            <td className="py-3.5 px-4 text-xs font-bold text-slate-800 font-mono">{period.month}</td>
                            <td className="py-3.5 px-3 text-xs font-semibold text-slate-700 text-right font-mono">{formatCurrency(period.planned)}</td>
                            <td className="py-3.5 px-3 text-xs font-semibold text-slate-700 text-right font-mono">{formatCurrency(period.forecast)}</td>
                            <td className="py-3.5 px-3 text-xs font-bold text-slate-800 text-right font-mono">{formatCurrency(period.actual)}</td>
                            <td className="py-3.5 px-3 text-right">
                              <span className={`text-xs font-bold font-mono ${getVarianceColor(period.variance)}`}>
                                {period.variance > 0 ? '+' : ''}{formatCurrency(period.variance)}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="inline-block px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                                {period.reason}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-xs text-slate-600 max-w-xs">{period.narrative}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            ) : (
              <Card>
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <IconAlertCircle className="w-12 h-12 text-slate-700 mb-3" />
                  <h3 className="text-sm font-semibold text-slate-700 mb-1">No Project Selected</h3>
                  <p className="text-xs text-slate-500">Select a project from the list to view detailed variance analysis</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

export default ForecastVsActuals;
