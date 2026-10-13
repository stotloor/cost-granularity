import React from 'react';
import { cn } from './ui.jsx';
import { IconAlertTriangle, IconAlertCircle, IconCheckCircle, IconXCircle } from './icons.jsx';
import { gbp, gbpShort } from '../lib/insights.js';

export function LoadState({ state, children }) {
  if (state.loading) {
    return <div className="py-24 text-center text-sm text-slate-500">Loading insights from the input workbook…</div>;
  }
  if (state.error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
        <p className="font-bold mb-1">Could not load insights</p>
        <p>{String(state.error.message || state.error)}</p>
      </div>
    );
  }
  return children(state.data);
}

export function Money({ value, short = false, className = '' }) {
  const neg = value < 0;
  return (
    <span className={cn('font-mono tabular-nums', neg ? 'text-amber-700' : '', className)} title={gbp(value)}>
      {short ? gbpShort(value) : gbp(value)}
    </span>
  );
}

const SEVERITY = {
  critical: { cls: 'bg-rose-50 text-rose-800 border-rose-300', Icon: IconXCircle },
  high: { cls: 'bg-rose-50 text-rose-700 border-rose-200', Icon: IconAlertTriangle },
  medium: { cls: 'bg-amber-50 text-amber-800 border-amber-200', Icon: IconAlertCircle },
  low: { cls: 'bg-slate-50 text-slate-700 border-slate-200', Icon: IconAlertCircle },
  info: { cls: 'bg-blue-50 text-blue-700 border-blue-200', Icon: IconAlertCircle },
};

export function SeverityBadge({ severity }) {
  const s = SEVERITY[severity] || SEVERITY.low;
  const Icon = s.Icon;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border capitalize whitespace-nowrap', s.cls)}>
      <Icon className="h-3 w-3" />
      {severity}
    </span>
  );
}

const REQ_STATUS = {
  met: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: IconCheckCircle },
  partial: { cls: 'bg-amber-50 text-amber-800 border-amber-200', Icon: IconAlertCircle },
  gap: { cls: 'bg-rose-50 text-rose-700 border-rose-200', Icon: IconXCircle },
  pass: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: IconCheckCircle },
  warn: { cls: 'bg-amber-50 text-amber-800 border-amber-200', Icon: IconAlertCircle },
  fail: { cls: 'bg-rose-50 text-rose-700 border-rose-200', Icon: IconXCircle },
  'not evidenced': { cls: 'bg-slate-50 text-slate-600 border-slate-200', Icon: IconAlertCircle },
};

export function CheckBadge({ status }) {
  const s = REQ_STATUS[status] || REQ_STATUS['not evidenced'];
  const Icon = s.Icon;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border capitalize whitespace-nowrap', s.cls)}>
      <Icon className="h-3 w-3" />
      {status}
    </span>
  );
}

export function FlagChip({ children, tone = 'amber' }) {
  const tones = {
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
    teal: 'bg-teal-50 text-teal-700 border-teal-200',
  };
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border whitespace-nowrap', tones[tone] || tones.amber)}>
      {children}
    </span>
  );
}

const ROSE_FLAGS = /exceed|> SAP|not in SAP|arithmetic|differs/i;
export function Flags({ flags = [] }) {
  if (!flags.length) return <span className="text-xs text-emerald-700 font-semibold">No flags</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {flags.map((f) => <FlagChip key={f} tone={ROSE_FLAGS.test(f) ? 'rose' : 'amber'}>{f}</FlagChip>)}
    </div>
  );
}

// Hover tooltip without state: the wrapper is a CSS group.
export function Tip({ content, children, className = '' }) {
  return (
    <div className={cn('relative group', className)}>
      {children}
      <div className="pointer-events-none absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg">
        {content}
      </div>
    </div>
  );
}

// Horizontal bar list: one series, magnitude by length. Credits draw from the same
// baseline in amber and are labelled, so sign is never colour-only.
export function BarList({ items, valueKey = 'value', labelKey = 'label', sublabel, onSelect, max: maxProp, format = gbpShort }) {
  const max = maxProp || Math.max(1, ...items.map((i) => Math.abs(i[valueKey] || 0)));
  return (
    <div className="space-y-2">
      {items.map((it, idx) => {
        const v = it[valueKey] || 0;
        const w = Math.max(0.5, (Math.abs(v) / max) * 100);
        const row = (
          <div className="grid grid-cols-[minmax(0,11rem)_1fr_5.5rem] sm:grid-cols-[minmax(0,15rem)_1fr_6rem] items-center gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-800 truncate" title={it[labelKey]}>{it[labelKey]}</div>
              {sublabel && <div className="text-[11px] text-slate-500 truncate">{sublabel(it)}</div>}
            </div>
            <Tip content={<span>{it[labelKey]}: {gbp(v)}{v < 0 ? ' (credit)' : ''}</span>}>
              <div className="h-5 flex items-center">
                <div
                  className={cn('h-3 rounded-r-[4px] transition-all', v < 0 ? 'bg-amber-500' : 'bg-teal-600')}
                  style={{ width: w + '%' }}
                />
              </div>
            </Tip>
            <div className={cn('text-right text-xs font-mono tabular-nums', v < 0 ? 'text-amber-700' : 'text-slate-900')}>
              {format(v)}{v < 0 ? ' cr' : ''}
            </div>
          </div>
        );
        return onSelect ? (
          <button key={idx} onClick={() => onSelect(it)} className="w-full text-left rounded-lg hover:bg-slate-50 px-1 -mx-1">{row}</button>
        ) : (
          <div key={idx}>{row}</div>
        );
      })}
    </div>
  );
}

// Vertical period bars for a single series (posting-period phasing).
export function PeriodBars({ labels, values, height = 140 }) {
  const max = Math.max(1, ...values.map((v) => Math.abs(v)));
  const hasNeg = values.some((v) => v < 0);
  const zero = hasNeg ? height / 2 : height;
  const scale = hasNeg ? height / 2 : height;
  return (
    <div>
      <div className="flex items-stretch gap-3" style={{ height: height + 'px' }}>
        {values.map((v, i) => {
          const h = Math.max(1, (Math.abs(v) / max) * scale);
          return (
            <Tip key={labels[i]} className="flex-1" content={<span>{labels[i]}: {gbp(v)}</span>}>
              <div className="relative w-full" style={{ height: height + 'px' }}>
                <div
                  className={cn('absolute left-1/2 -translate-x-1/2 w-3/5 max-w-[48px]', v < 0 ? 'bg-amber-500 rounded-b-[4px]' : 'bg-teal-600 rounded-t-[4px]')}
                  style={v < 0 ? { top: zero + 'px', height: h + 'px' } : { top: zero - h + 'px', height: h + 'px' }}
                />
              </div>
            </Tip>
          );
        })}
      </div>
      <div className="border-t border-slate-200 mt-0" />
      <div className="flex gap-3 mt-1.5">
        {values.map((v, i) => (
          <div key={labels[i]} className="flex-1 text-center">
            <div className="text-[11px] font-semibold text-slate-600">{labels[i]}</div>
            <div className={cn('text-[11px] font-mono', v < 0 ? 'text-amber-700' : 'text-slate-500')}>{gbpShort(v)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Tiny inline period profile for table rows.
export function Sparkbars({ values }) {
  const max = Math.max(1, ...values.map((v) => Math.abs(v)));
  return (
    <div className="flex items-center gap-[2px] h-5" title={values.map((v, i) => 'P' + (i + 1) + ': ' + gbp(v)).join('\n')}>
      {values.map((v, i) => (
        <div key={i} className="relative w-2 h-5">
          <div
            className={cn('absolute left-0 w-2', v < 0 ? 'top-1/2 bg-amber-500 rounded-b-[2px]' : 'bottom-1/2 bg-teal-600 rounded-t-[2px]')}
            style={{ height: Math.max(1, (Math.abs(v) / max) * 10) + 'px' }}
          />
        </div>
      ))}
    </div>
  );
}

// Two-part consumption bar: posted vs remaining commitment.
export function ConsumptionBar({ posted, total }) {
  const p = total ? Math.min(100, (posted / total) * 100) : 0;
  return (
    <Tip content={<span>Posted {gbp(posted)} of {gbp(total)} ({p.toFixed(1)}%)</span>}>
      <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-[4px]">
        <div className="bg-teal-600 h-full rounded-l-[4px]" style={{ width: p + '%' }} />
        <div className="bg-slate-200 h-full flex-1 rounded-r-[4px]" />
      </div>
    </Tip>
  );
}

export function Kpi({ label, value, sub, tone }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={cn('mt-2 text-2xl font-extrabold tracking-tight tabular-nums', tone === 'bad' ? 'text-rose-700' : tone === 'warn' ? 'text-amber-700' : 'text-slate-900')}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-slate-600">{sub}</div>}
    </div>
  );
}

export function SectionNote({ children }) {
  return <p className="text-xs text-slate-500 leading-relaxed">{children}</p>;
}

export function Select({ value, onChange, options, className = '' }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn('px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-2xs', className)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
