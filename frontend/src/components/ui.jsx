import React from 'react';

const _CN_CATS = [
  /^text-(?:(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)(?:\/[0-9]+)?|\[[0-9.]+(?:px|rem|em)\])$/,
  /^text-(?:left|center|right|justify|start|end)$/,
  /^text-(?!(?:left|center|right|justify|start|end|xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)(?:\/|$|\s))(?:white|black|transparent|inherit|current|(?:[a-zA-Z]+-[0-9]{2,3}(?:\/[0-9]+)?)|\[(?![0-9.]+(?:px|rem|em)\]).+\])$/,
  /^bg-(?:white|black|transparent|inherit|current|(?:[a-zA-Z]+-[0-9]{2,3}(?:\/[0-9]+)?)|\[.+\])$/,
  /^p-(?:[0-9]+(?:\.[0-9]+)?|px|auto|\[.+\])$/,
  /^px-(?:[0-9]+(?:\.[0-9]+)?|px|auto|\[.+\])$/,
  /^py-(?:[0-9]+(?:\.[0-9]+)?|px|auto|\[.+\])$/,
  /^pt-(?:[0-9]+(?:\.[0-9]+)?|px|auto|\[.+\])$/,
  /^pr-(?:[0-9]+(?:\.[0-9]+)?|px|auto|\[.+\])$/,
  /^pb-(?:[0-9]+(?:\.[0-9]+)?|px|auto|\[.+\])$/,
  /^pl-(?:[0-9]+(?:\.[0-9]+)?|px|auto|\[.+\])$/,
  /^font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/,
  /^m-(?:[0-9]+(?:\.[0-9]+)?|px|auto|\[.+\])$/,
  /^mx-(?:[0-9]+(?:\.[0-9]+)?|px|auto|\[.+\])$/,
  /^my-(?:[0-9]+(?:\.[0-9]+)?|px|auto|\[.+\])$/,
  /^mt-(?:[0-9]+(?:\.[0-9]+)?|px|auto|\[.+\])$/,
  /^mr-(?:[0-9]+(?:\.[0-9]+)?|px|auto|\[.+\])$/,
  /^mb-(?:[0-9]+(?:\.[0-9]+)?|px|auto|\[.+\])$/,
  /^ml-(?:[0-9]+(?:\.[0-9]+)?|px|auto|\[.+\])$/,
  /^rounded(?:-(?:none|xs|sm|md|lg|xl|2xl|3xl|full|\[.+\]))?$/,
  /^border(?:-(?:[0-9]+|\[.+\]))?$/,
  /^border-(?!(?:[0-9]|collapse|separate|solid|dashed|dotted|double|hidden|none|t-|b-|l-|r-|x-|y-))(?:white|black|transparent|inherit|current|(?:[a-zA-Z]+-[0-9]{2,3}(?:\/[0-9]+)?)|\[.+\])$/,
  /^shadow(?:-(?:none|2xs|xs|sm|md|lg|xl|2xl|inner|\[.+\]))?$/,
  /^opacity-(?:[0-9]+|\[.+\])$/
];

export function cn(...classes) {
  const tokens = classes.filter(Boolean).join(' ').split(/\s+/).filter(Boolean);
  const lastMap = new Map();
  tokens.forEach((t) => {
    const clean = t.replace(/^!/, '');
    for (let i = 0; i < _CN_CATS.length; i++) {
      if (_CN_CATS[i].test(clean)) { lastMap.set(i, t); break; }
    }
  });
  const seen = new Set();
  const out = [];
  tokens.forEach((t) => {
    const clean = t.replace(/^!/, '');
    let matchedIdx = -1;
    for (let i = 0; i < _CN_CATS.length; i++) {
      if (_CN_CATS[i].test(clean)) { matchedIdx = i; break; }
    }
    if (matchedIdx !== -1) {
      if (lastMap.get(matchedIdx) === t && !seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    } else if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  });
  return out.join(' ');
}

function _renderAction(act, key) {
  if (!act) return null;
  if (React.isValidElement(act)) return React.cloneElement(act, { key: act.key || key });
  if (typeof act === 'string') {
    return (
      <button key={key} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs">
        {act}
      </button>
    );
  }
  if (typeof act === 'object' && (act.label || act.text || act.name)) {
    const text = act.label || act.text || act.name;
    const isPrimary = act.variant === 'primary';
    const cls = isPrimary
      ? "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs"
      : "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs";
    const Icon = act.icon;
    return (
      <button key={key} onClick={act.onClick} className={cls}>
        {Icon && <Icon className="h-3.5 w-3.5" />}
        <span>{text}</span>
      </button>
    );
  }
  return null;
}

export function PageContainer({ children, maxWidth = 'max-w-7xl', className = '' }) {
  return (
    <div className={`w-full ${maxWidth} mx-auto px-6 sm:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8 ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({ eyebrow, title, subtitle, description, actions, badge }) {
  const desc = subtitle || description;
  const renderedActions = Array.isArray(actions)
    ? actions.map((a, i) => _renderAction(a, i))
    : (actions && typeof actions === 'object' && !React.isValidElement(actions))
      ? _renderAction(actions, 0)
      : actions;

  const renderedBadge = (badge && typeof badge === 'object' && !React.isValidElement(badge))
    ? (badge.label || badge.text || '')
    : badge;

  return (
    <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="text-xs font-bold uppercase tracking-wider text-teal-600 mb-1">{eyebrow}</p>
        )}
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{title}</h1>
          {renderedBadge && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
              {renderedBadge}
            </span>
          )}
        </div>
        {desc && <p className="mt-1 text-sm text-slate-600 max-w-2xl">{desc}</p>}
      </div>
      {renderedActions && <div className="flex items-center gap-3 flex-wrap">{renderedActions}</div>}
    </div>
  );
}

export function Card({ children, className = '', title, subtitle, headerAction, ...props }) {
  const renderedHeaderAction = (headerAction && typeof headerAction === 'object' && !React.isValidElement(headerAction))
    ? _renderAction(headerAction, 'card-action')
    : headerAction;
  const hasCustomBg = Boolean(className && /(?:^|\s)!?bg-(?!opacity)/.test(className));

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 p-6 shadow-sm hover:shadow transition-shadow",
        hasCustomBg ? "" : "bg-white",
        className
      )}
      {...props}
    >
      {(title || renderedHeaderAction) && (
        <div className="mb-5 flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            {title && <h3 className="text-base font-bold text-slate-900">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-600 mt-0.5">{subtitle}</p>}
          </div>
          {renderedHeaderAction && <div>{renderedHeaderAction}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  delta,
  deltaTone = 'positive',
  subtitle,
  icon: Icon,
  iconColor = 'teal',
  progress,
  target,
  className = '',
  valueClassName = '',
  ...props
}) {
  const isPos = deltaTone === 'positive';
  const colorMap = {
    teal: "bg-teal-50 text-teal-600 border border-teal-100",
    emerald: "bg-emerald-50 text-emerald-600 border border-emerald-100",
    blue: "bg-blue-50 text-blue-600 border border-blue-100",
    rose: "bg-rose-50 text-rose-600 border border-rose-100",
    amber: "bg-amber-50 text-amber-600 border border-amber-100",
    indigo: "bg-indigo-50 text-indigo-600 border border-indigo-100",
  };
  const iconClasses = colorMap[iconColor] || colorMap.teal;
  const hasCustomBg = Boolean(className && /(?:^|\s)!?bg-(?!opacity)/.test(className));

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between",
        hasCustomBg ? "" : "bg-white",
        className
      )}
      {...props}
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600">{label}</span>
          {Icon && (
            <div className={cn("h-10 w-10 rounded-full flex items-center justify-center shadow-xs", iconClasses)}>
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
        <div className="my-2">
          <span className={cn("text-3xl font-extrabold text-slate-900 tracking-tight", valueClassName)}>{value}</span>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-slate-100">
        {progress !== undefined ? (
          <div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-1.5">
              <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
            </div>
            {target && <span className="text-xs text-slate-600 font-semibold">{target}</span>}
          </div>
        ) : delta ? (
          <div className="flex items-center gap-1.5">
            <span className={cn("text-xs font-bold flex items-center gap-0.5", isPos ? "text-emerald-600" : "text-rose-600")}>
              {delta}
            </span>
            {subtitle && <span className="text-xs text-slate-600 font-medium">· {subtitle}</span>}
          </div>
        ) : subtitle ? (
          <span className="text-xs text-slate-600 font-medium">{subtitle}</span>
        ) : null}
      </div>
    </div>
  );
}

export function StatusBadge({ status = 'Active', size = 'sm' }) {
  const statusStr = (status && typeof status === 'object')
    ? (status.label || status.name || status.status || 'Active')
    : String(status || 'Active');
  const s = statusStr.toLowerCase();
  let color = "bg-slate-100 text-slate-700 border-slate-200";
  if (s.includes('active') || s.includes('complete') || s.includes('approved') || s.includes('success') || s.includes('on-track')) {
    color = "bg-emerald-50 text-emerald-700 border-emerald-200";
  } else if (s.includes('pending') || s.includes('wait') || s.includes('review') || s.includes('attention')) {
    color = "bg-amber-50 text-amber-700 border-amber-200";
  } else if (s.includes('fail') || s.includes('error') || s.includes('breach') || s.includes('critical') || s.includes('exception')) {
    color = "bg-rose-50 text-rose-700 border-rose-200";
  } else if (s.includes('progress') || s.includes('running') || s.includes('open') || s.includes('initiated')) {
    color = "bg-blue-50 text-blue-700 border-blue-200";
  }

  return (
    <span className={cn("inline-flex items-center font-semibold rounded-full border shadow-2xs", size === 'sm' ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm", color)}>
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current"></span>
      {statusStr}
    </span>
  );
}

export function RiskBadge({ level = 'Low' }) {
  const levelStr = (level && typeof level === 'object')
    ? (level.label || level.name || level.level || 'Low')
    : String(level || 'Low');
  const l = levelStr.toLowerCase();
  let color = "bg-slate-100 text-slate-700 border-slate-200";
  if (l === 'low') color = "bg-emerald-50 text-emerald-700 border-emerald-200";
  else if (l === 'medium') color = "bg-amber-50 text-amber-700 border-amber-200";
  else if (l === 'high') color = "bg-orange-50 text-orange-700 border-orange-200";
  else if (l === 'critical') color = "bg-rose-50 text-rose-700 border-rose-200";

  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border", color)}>
      {levelStr}
    </span>
  );
}

export function ProgressBar({ value = 0, max = 100, label, count, color = "teal" }) {
  const pct = Math.min(100, Math.max(0, Math.round((value / max) * 100)));
  const colorMap = {
    teal: "bg-teal-500",
    amber: "bg-amber-500",
    orange: "bg-orange-500",
    emerald: "bg-emerald-500",
    blue: "bg-blue-500",
    indigo: "bg-indigo-500",
    slate: "bg-slate-400",
  };
  const barColor = colorMap[color] || colorMap.teal;

  return (
    <div className="w-full">
      {(label || count !== undefined) && (
        <div className="flex justify-between items-center text-xs font-medium text-slate-700 mb-1.5">
          <span>{label}</span>
          <span className="font-bold text-slate-900">{count !== undefined ? count : `${pct}%`}</span>
        </div>
      )}
      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-500", barColor)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Button({ children, variant = 'primary', size = 'md', icon: Icon, onClick, disabled, className = '' }) {
  const base = "inline-flex items-center justify-center font-semibold rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none";
  const sizes = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-5 py-2.5 text-base gap-2.5",
  };
  const variants = {
    primary: "bg-teal-600 text-white hover:bg-teal-700 focus:ring-teal-500 shadow-sm shadow-teal-100",
    secondary: "bg-slate-100 text-slate-800 hover:bg-slate-200 focus:ring-slate-400",
    outline: "border border-slate-300/80 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-400 shadow-xs",
    danger: "bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-500 shadow-sm",
  };

  return (
    <button onClick={onClick} disabled={disabled} className={cn(base, sizes[size] || sizes.md, variants[variant] || variants.primary, className)}>
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function Tabs({ tabs = [], activeTab, onChange }) {
  const activeId = typeof activeTab === 'object' && activeTab !== null
    ? (activeTab.id || activeTab.key || activeTab.value || activeTab.label)
    : activeTab;

  return (
    <div className="flex border-b border-slate-200 gap-8">
      {tabs.map((tab, idx) => {
        const id = typeof tab === 'object' ? (tab.id || tab.key || tab.value || tab.label || idx) : tab;
        const label = typeof tab === 'object' ? (tab.label || tab.name || tab.title || tab.id || '') : String(tab);
        const count = typeof tab === 'object' ? tab.count : undefined;
        const active = activeId === id || activeTab === tab || activeTab === label;
        return (
          <button
            key={id}
            onClick={() => onChange && onChange(typeof tab === 'object' ? (tab.id || tab) : tab)}
            className={cn(
              "pb-3.5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2",
              active ? "border-teal-600 text-teal-700 font-bold" : "border-transparent text-slate-600 hover:text-slate-900"
            )}
          >
            <span>{label}</span>
            {count !== undefined && (
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-bold", active ? "bg-teal-100 text-teal-800" : "bg-slate-100 text-slate-700")}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            ✕
          </button>
        </div>
        <div className="py-4">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  const renderedAction = (action && typeof action === 'object' && !React.isValidElement(action))
    ? _renderAction(action, 'empty-action')
    : action;

  return (
    <div className="py-12 px-4 text-center flex flex-col items-center justify-center">
      {Icon && (
        <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <h4 className="text-base font-bold text-slate-800">{title}</h4>
      {description && <p className="text-sm text-slate-400 max-w-sm mt-1">{description}</p>}
      {renderedAction && <div className="mt-5">{renderedAction}</div>}
    </div>
  );
}

export function FilterBar({ filters = [], activeFilter, onFilterChange, search, onSearch, actions }) {
  const renderedActions = Array.isArray(actions)
    ? actions.map((a, i) => _renderAction(a, i))
    : (actions && typeof actions === 'object' && !React.isValidElement(actions))
      ? _renderAction(actions, 'filter-action')
      : actions;

  const activeId = typeof activeFilter === 'object' && activeFilter !== null
    ? (activeFilter.id || activeFilter.key || activeFilter.value || activeFilter.label)
    : activeFilter;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-3 flex-1 flex-wrap">
        {onSearch && (
          <input
            type="text"
            placeholder="Search records, metrics, cases..."
            value={search || ""}
            onChange={e => onSearch(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 w-full max-w-xs shadow-2xs"
          />
        )}
        {filters.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {filters.map((f, i) => {
              const id = typeof f === 'object' ? (f.id || f.key || f.value || f.label || i) : f;
              const label = typeof f === 'object' ? (f.label || f.name || f.title || f.text || f.id || '') : String(f);
              const count = typeof f === 'object' ? f.count : undefined;
              const active = activeId === id || activeFilter === f || activeFilter === label;
              return (
                <button
                  key={id}
                  onClick={() => onFilterChange && onFilterChange(typeof f === 'object' ? (f.id || f) : f)}
                  className={cn(
                    "px-3 py-1.5 text-xs rounded-xl font-semibold transition-all inline-flex items-center gap-1.5",
                    active ? "bg-teal-50 text-teal-700 border border-teal-200 shadow-2xs" : "border border-slate-200/80 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs"
                  )}
                >
                  <span>{label}</span>
                  {count !== undefined && (
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-bold", active ? "bg-teal-200/60 text-teal-800" : "bg-slate-100 text-slate-700")}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {renderedActions && <div>{renderedActions}</div>}
    </div>
  );
}

export function TimelineItem({ title, timestamp, description, status = "info", actor }) {
  return (
    <div className="relative pl-7 pb-6 border-l-2 border-slate-200 last:border-transparent">
      <span className="absolute -left-1.5 top-0.5 h-3.5 w-3.5 rounded-full bg-teal-600 ring-4 ring-white" />
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-bold text-slate-900">{title}</h4>
        {timestamp && <span className="text-xs text-slate-400 font-medium">{timestamp}</span>}
      </div>
      {actor && <p className="text-xs font-semibold text-teal-700 mt-0.5">{actor}</p>}
      {description && <p className="text-xs text-slate-600 mt-1 leading-relaxed">{description}</p>}
    </div>
  );
}
