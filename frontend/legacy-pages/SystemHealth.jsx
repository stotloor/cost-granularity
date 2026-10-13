import React from 'react';
import { Card, PageHeader, StatusBadge, ProgressBar } from '../components/ui.jsx';
import { IconActivity, IconServer, IconDatabase, IconCloud, IconRefreshCw, IconCheckCircle, IconAlertTriangle } from '../components/icons.jsx';

function SystemHealthCard({ title, status, uptime, lastChecked, metrics }) {
  const statusLower = (status || '').toLowerCase();
  const isHealthy = statusLower.includes('healthy') || statusLower.includes('operational');

  return (
    <Card className="hover:border-teal-200 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Last checked: {lastChecked || 'N/A'}
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      {uptime !== undefined && (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs font-medium text-slate-600">Uptime</span>
            <span className="text-xs font-bold text-slate-900">{uptime}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all ${
                uptime >= 99 ? 'bg-emerald-500' : uptime >= 95 ? 'bg-amber-500' : 'bg-rose-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, uptime))}%` }}
            />
          </div>
        </div>
      )}

      {metrics && metrics.length > 0 && (
        <div className="space-y-2 pt-3 border-t border-slate-100">
          {metrics.map((metric, idx) => (
            <div key={idx} className="flex justify-between items-center text-xs">
              <span className="text-slate-600 font-medium">{metric.label || metric.name || 'Metric'}</span>
              <span className="font-bold text-slate-900">{metric.value || 'N/A'}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function SystemHealth() {
  const systems = [
    {
      title: 'SAP S/4HANA Integration',
      status: 'Healthy',
      uptime: 99.8,
      lastChecked: '2 min ago',
      metrics: [
        { label: 'Avg Response Time', value: '120ms' },
        { label: 'Transactions/min', value: '1,240' },
        { label: 'Error Rate', value: '0.02%' },
      ],
    },
    {
      title: 'Oracle ERP Cloud',
      status: 'Healthy',
      uptime: 99.9,
      lastChecked: '1 min ago',
      metrics: [
        { label: 'Avg Response Time', value: '95ms' },
        { label: 'Transactions/min', value: '980' },
        { label: 'Error Rate', value: '0.01%' },
      ],
    },
    {
      title: 'Maximo Asset Management',
      status: 'Attention Required',
      uptime: 98.2,
      lastChecked: '5 min ago',
      metrics: [
        { label: 'Avg Response Time', value: '340ms' },
        { label: 'Transactions/min', value: '450' },
        { label: 'Error Rate', value: '0.15%' },
      ],
    },
    {
      title: 'Data Warehouse ETL',
      status: 'Healthy',
      uptime: 99.5,
      lastChecked: '3 min ago',
      metrics: [
        { label: 'Last Run', value: '00:45 ago' },
        { label: 'Records Processed', value: '2.4M' },
        { label: 'Success Rate', value: '99.8%' },
      ],
    },
  ];

  const overallUptime = (
    systems.reduce((acc, s) => acc + (s.uptime || 0), 0) / systems.length
  ).toFixed(1);

  const healthyCount = systems.filter((s) =>
    (s.status || '').toLowerCase().includes('healthy')
  ).length;

  return (
    <div>
      <PageHeader
        title="System Health"
        subtitle="Monitor the health and performance of all integrated systems"
        badge={`${healthyCount}/${systems.length} Healthy`}
        actions={[
          { label: 'Refresh All', icon: IconRefreshCw, variant: 'outline' },
          { label: 'View Logs', variant: 'primary' },
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Overall Uptime
            </span>
            <IconCheckCircle className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-900">{overallUptime}%</div>
          <p className="text-xs text-emerald-700 mt-1">Last 30 days</p>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
              Active Systems
            </span>
            <IconServer className="h-5 w-5 text-blue-600" />
          </div>
          <div className="text-3xl font-extrabold text-blue-900">{healthyCount}/{systems.length}</div>
          <p className="text-xs text-blue-700 mt-1">Operational</p>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
              Avg Response
            </span>
            <IconActivity className="h-5 w-5 text-amber-600" />
          </div>
          <div className="text-3xl font-extrabold text-amber-900">138ms</div>
          <p className="text-xs text-amber-700 mt-1">Across all systems</p>
        </Card>

        <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Total Transactions
            </span>
            <IconDatabase className="h-5 w-5 text-slate-600" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900">2.67K</div>
          <p className="text-xs text-slate-700 mt-1">Per minute</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {systems.map((system, idx) => (
          <SystemHealthCard key={idx} {...system} />
        ))}
      </div>

      <Card className="mt-8" title="Recent System Events">
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
            <IconCheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900">SAP S/4HANA backup completed successfully</p>
              <p className="text-xs text-slate-600 mt-0.5">15 minutes ago</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <IconAlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900">Maximo response time degraded</p>
              <p className="text-xs text-slate-600 mt-0.5">32 minutes ago · Investigating</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <IconRefreshCw className="h-5 w-5 text-slate-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900">Scheduled maintenance: Oracle ERP Cloud</p>
              <p className="text-xs text-slate-600 mt-0.5">Tomorrow at 2:00 AM UTC</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
