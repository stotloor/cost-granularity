import React, { useMemo, useState } from 'react';
import { IconLayoutDashboard, IconAlertTriangle, IconReceipt, IconNetwork, IconFolderTree, IconLayers, IconDatabase, IconList, IconMenu, IconX, IconSearch, IconMessageSquare } from './components/icons.jsx';
import Dashboard from './pages/Dashboard.jsx';
import PurchaseOrders from './pages/PurchaseOrders.jsx';
import Projects from './pages/Projects.jsx';
import InvestmentTraceability from './pages/InvestmentTraceability.jsx';
import ActivityAnalysis from './pages/ActivityAnalysis.jsx';
import ExceptionMonitor from './pages/ExceptionMonitor.jsx';
import DataQuality from './pages/DataQuality.jsx';
import RequirementsMap from './pages/RequirementsMap.jsx';
import AiAssistant from './pages/AiAssistant.jsx';
import { useInsights, gbpShort } from './lib/insights.js';

const PAGES = {
  Dashboard,
  PurchaseOrders,
  Projects,
  Investments: InvestmentTraceability,
  Activities: ActivityAnalysis,
  Exceptions: ExceptionMonitor,
  DataQuality,
  RequirementsMap,
  Assistant: AiAssistant,
};

const baseNav = [
  { id: 'Dashboard', label: 'Overview', icon: IconLayoutDashboard },
  { id: 'PurchaseOrders', label: 'Purchase Orders', icon: IconReceipt },
  { id: 'Projects', label: 'Projects & WBS', icon: IconFolderTree },
  { id: 'Investments', label: 'Investment Traceability', icon: IconNetwork },
  { id: 'Activities', label: 'Activity Analysis', icon: IconLayers },
  { id: 'Exceptions', label: 'Exceptions', icon: IconAlertTriangle },
  { id: 'DataQuality', label: 'Data Quality', icon: IconDatabase },
  { id: 'RequirementsMap', label: 'Requirements Map', icon: IconList },
  { id: 'Assistant', label: 'AI Assistant', icon: IconMessageSquare },
];

// Global search: jump to the first PO, project, submission or WBS that matches.
function searchIndex(data) {
  if (!data) return [];
  const out = [];
  data.pos.forEach((p) => out.push({ page: 'PurchaseOrders', focus: p.po_number, label: p.po_number, sub: p.description, keys: [p.po_number, p.supplier_id, p.contract_ref, p.description] }));
  data.projects.forEach((p) => {
    out.push({ page: 'Projects', focus: p.project, label: p.project, sub: `${p.project_name} · ${gbpShort(p.ytd)}`, keys: [p.project, p.project_name, p.person_responsible, p.initiative_id, p.scheme_ref] });
    p.wbs.forEach((w) => out.push({ page: 'Projects', focus: p.project, label: w.wbs_description, sub: `WBS in ${p.project}`, keys: [w.wbs, w.wbs_description] }));
  });
  data.submissions.forEach((x) => out.push({ page: 'Investments', focus: x.submission_id, label: x.submission_id, sub: `${x.investment_count} investments`, keys: [x.submission_id, ...x.investments] }));
  data.investments.forEach((i) => out.push({ page: 'Investments', focus: i.submission_id, label: i.investment_code, sub: `${i.investment_name} · ${i.submission_id}`, keys: [i.investment_code, i.investment_name, i.pac_code, i.site_id] }));
  return out;
}

function App() {
  const [nav, setNav] = useState({ page: 'Dashboard', focus: null, seq: 0 });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { data } = useInsights();
  const activePage = nav.page;
  const setActivePage = (page, focus = null) => {
    setNav((n) => ({ page, focus, seq: n.seq + 1 }));
    setQuery('');
  };
  const navItems = useMemo(() => baseNav.map((item) => {
    if (!data) return { ...item, badge: '' };
    if (item.id === 'Exceptions') return { ...item, badge: String(data.summary.exceptions_by_severity.high || '') };
    if (item.id === 'PurchaseOrders') return { ...item, badge: String(data.summary.po_count) };
    return { ...item, badge: '' };
  }), [data]);
  const index = useMemo(() => searchIndex(data), [data]);
  const q = query.trim().toLowerCase();
  const hits = q.length < 2 ? [] : index.filter((h) => h.keys.some((k) => String(k || '').toLowerCase().includes(q))).slice(0, 8);
  const Page = PAGES[activePage] || Dashboard;

  const renderNavItem = (item, isMobile = false) => {
    const Icon = item.icon;
    const isActive = activePage === item.id;
    return (
      <button
        key={item.id}
        onClick={() => {
          setActivePage(item.id);
          if (isMobile) setSidebarOpen(false);
        }}
        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${
          isActive
            ? 'border border-teal-500/30 bg-teal-500/10 text-teal-300 font-semibold shadow-xs'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 font-medium'
        }`}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="flex-1 text-left text-sm">{item.label}</span>
        {item.badge && (
          <span className={`${item.id === 'Exceptions' ? 'bg-rose-500/20 text-rose-300' : 'bg-teal-500/20 text-teal-300'} rounded-full px-2 py-0.5 text-xs font-bold`} title={item.id === 'Exceptions' ? 'High-severity exceptions' : undefined}>
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="h-screen flex overflow-hidden bg-slate-50/75">
      {}
      <aside className="hidden lg:flex w-64 flex-col bg-[#0b132b] text-slate-300 shadow-xl z-20 shrink-0">
        {}
        <div className="h-16 flex items-center gap-3 px-4 border-b border-slate-800/80 shrink-0">
          <div className="h-10 w-10 rounded-xl bg-teal-500 flex items-center justify-center text-white font-extrabold text-lg shadow-md shadow-teal-500/20">
            CG
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-bold text-base leading-tight truncate">
              Cost Granularity
            </div>
            <div className="text-slate-400 text-xs font-medium">
              Controller
            </div>
          </div>
        </div>

        {}
        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
          {navItems.map((item) => renderNavItem(item, false))}
        </nav>

        {}
        <div className="border-t border-slate-800/80 p-4 shrink-0">
          <div className="flex items-center gap-3">
            <IconDatabase className="h-5 w-5 text-teal-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-white text-xs font-bold truncate" title={data ? data.meta.source : ''}>{data ? data.meta.source : 'Loading data…'}</div>
              <div className="text-slate-400 text-[11px]">{data ? `${data.meta.sheets.length} sheets · ${data.meta.sheets.reduce((a, x) => a + x.records, 0)} records` : ''}</div>
            </div>
          </div>
        </div>
      </aside>

      {}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] flex flex-col bg-[#0b132b] text-slate-300 shadow-2xl z-10">
            {}
            <div className="h-16 flex items-center gap-3 px-4 border-b border-slate-800/80 shrink-0">
              <div className="h-10 w-10 rounded-xl bg-teal-500 flex items-center justify-center text-white font-extrabold text-lg shadow-md shadow-teal-500/20">
                CG
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-bold text-base leading-tight truncate">
                  Cost Granularity
                </div>
                <div className="text-slate-400 text-xs font-medium">
                  Controller
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60"
              >
                <IconX className="h-5 w-5" />
              </button>
            </div>

            {}
            <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
              {navItems.map((item) => renderNavItem(item, true))}
            </nav>

            {}
            <div className="border-t border-slate-800/80 p-4 shrink-0">
              <div className="flex items-center gap-3">
                <IconDatabase className="h-5 w-5 text-teal-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-white text-xs font-bold truncate" title={data ? data.meta.source : ''}>{data ? data.meta.source : 'Loading data…'}</div>
                  <div className="text-slate-400 text-[11px]">{data ? `${data.meta.sheets.length} sheets · ${data.meta.sheets.reduce((a, x) => a + x.records, 0)} records` : ''}</div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {}
      <div className="flex-1 flex flex-col overflow-hidden">
        {}
        <header className="h-16 border-b border-slate-200/80 bg-white px-4 sm:px-8 flex items-center justify-between shrink-0 z-10">
          {}
          <div className="flex items-center gap-3 sm:gap-4">
            {}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-1 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <IconMenu className="h-5 w-5" />
            </button>

            <span className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium text-sm">
              {data ? `${data.summary.project_count} projects · ${gbpShort(data.summary.sap_ytd)} SAP YTD` : 'Loading…'}
            </span>
          </div>

          <div className="flex-1 max-w-[220px] sm:max-w-xs md:max-w-md mx-4">
            <div className="relative">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && hits[0]) setActivePage(hits[0].page, hits[0].focus);
                  if (e.key === 'Escape') setQuery('');
                }}
                placeholder="Search PO, project, WBS, investment…"
                className="w-full pl-9 pr-3 py-2 bg-slate-50/75 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
              />
              {hits.length > 0 && (
                <div className="absolute z-40 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                  {hits.map((h, i) => (
                    <button
                      key={h.page + h.label + i}
                      onClick={() => setActivePage(h.page, h.focus)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                    >
                      <div className="text-sm font-semibold text-slate-900 truncate">{h.label}</div>
                      <div className="text-xs text-slate-500 truncate">{h.sub} · {baseNav.find((n) => n.id === h.page).label}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="hidden md:block w-24" />
        </header>

        {}
        <main className="flex-1 overflow-y-auto bg-slate-50/75 p-4 sm:p-6 lg:p-8">
          <div className="w-full max-w-7xl mx-auto space-y-6 sm:space-y-8">
            <Page key={activePage + nav.seq} onNavigate={setActivePage} focus={nav.focus} />
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;