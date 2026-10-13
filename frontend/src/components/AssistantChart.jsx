// Renders a "cg-chart" v1 spec produced by the MCP create_chart tool (see mcp-server/charts.py).
// Lazy-loaded by the AI Assistant page so recharts is only fetched when a reply contains a chart.
import React, { useEffect, useRef, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, LabelList,
} from 'recharts';

// Categorical slots in fixed order (validated: colorblind-safe adjacent pairs on white).
// Color follows the series' position in the spec, never its rank.
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
const INK = { primary: '#0b0b0b', secondary: '#52514e', muted: '#898781' };
const GRID = '#e1e0d9';
const AXIS = '#c3c2b7';
const SURFACE = '#ffffff';
const CHART_TYPES = ['bar', 'horizontal_bar', 'line', 'area', 'pie', 'scatter'];
const OTHER = '#b4b2a9'; // folded "Other" slice: neutral, it is not an entity
const sliceColor = (d, key, i) => (String(d[key]).startsWith('Other (') ? OTHER : SERIES[i % SERIES.length]);

// One-line category tick; long names are truncated (the tooltip and table show them in full).
function CategoryTick({ x, y, payload, maxChars }) {
  const text = String(payload.value);
  const shown = text.length > maxChars ? text.slice(0, maxChars - 1) + '…' : text;
  return <text x={x} y={y} dx={-4} dy={4} textAnchor="end" fontSize={11} fill={INK.muted}><title>{text}</title>{shown}</text>;
}

export function parseChartSpec(source) {
  let spec;
  try {
    spec = JSON.parse(source);
  } catch (_) {
    return { error: 'The chart data is not valid JSON.' };
  }
  const ok = spec && spec.type === 'cg-chart' && spec.version === 1 && CHART_TYPES.includes(spec.chart)
    && spec.x && typeof spec.x.key === 'string' && Array.isArray(spec.series) && spec.series.length > 0
    && Array.isArray(spec.data) && spec.data.length > 0;
  return ok ? { spec } : { error: 'The chart spec is incomplete or uses an unsupported format.' };
}

function formatter(unit, compact) {
  if (unit === 'gbp') {
    return (v) => (v == null ? '–' : compact
      ? '£' + new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(v)
      : new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: Math.abs(v) < 100 ? 2 : 0 }).format(v));
  }
  if (unit === 'percent') return (v) => (v == null ? '–' : `${Number(v).toLocaleString('en-GB', { maximumFractionDigits: 1 })}%`);
  return (v) => (v == null ? '–' : new Intl.NumberFormat('en-GB', compact ? { notation: 'compact', maximumFractionDigits: 1 } : { maximumFractionDigits: 2 }).format(v));
}

function ChartTooltip({ active, payload, label, spec, full }) {
  if (!active || !payload || !payload.length) return null;
  let heading = label;
  let rows = payload.map((p) => ({ key: p.dataKey + String(p.name), name: p.name, color: p.color || p.fill, value: p.value }));
  if (spec.chart === 'pie') {
    const p = payload[0];
    heading = p.payload[spec.x.key];
    rows = [{ key: 'pie', name: spec.series[0].label, color: p.payload.fill, value: p.value }];
  } else if (spec.chart === 'scatter') {
    const d = payload[0].payload;
    heading = `${spec.x.label}: ${Number(d.__x).toLocaleString('en-GB')}`;
    rows = [{ key: 'scatter', name: d.__series, color: d.__color, value: d.__y }];
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold mb-1" style={{ color: INK.primary }}>{heading}</div>
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-2" style={{ color: INK.secondary }}>
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: r.color }} />
          <span className="flex-1">{r.name}</span>
          <span className="font-semibold tabular-nums" style={{ color: INK.primary }}>{full(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

function Legend({ items }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: INK.secondary }}>
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

function DataTable({ spec, full }) {
  return (
    <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-slate-200">
      <table className="min-w-full text-xs">
        <thead className="bg-slate-50 sticky top-0" style={{ color: INK.secondary }}>
          <tr>
            <th className="px-3 py-2 text-left font-semibold">{spec.x.label}</th>
            {spec.series.map((s) => <th key={s.key} className="px-3 py-2 text-right font-semibold">{s.label}</th>)}
          </tr>
        </thead>
        <tbody style={{ color: INK.primary }}>
          {spec.data.map((d, i) => (
            <tr key={i} className="border-t border-slate-100">
              <td className="px-3 py-1.5">{String(d[spec.x.key])}</td>
              {spec.series.map((s) => <td key={s.key} className="px-3 py-1.5 text-right tabular-nums">{full(d[s.key])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Value at the end of each line (selective direct label), only when lines are few.
const endLabel = (lastIndex, fmt) => function EndLabel({ x, y, value, index }) {
  if (index !== lastIndex || value == null) return null;
  return <text x={x + 6} y={y} dy={4} fontSize={11} fill={INK.secondary}>{fmt(value)}</text>;
};

function Plot({ spec, compact, full, width }) {
  const { chart, data, series, x } = spec;
  const stack = spec.stacked ? 'stack' : undefined;
  const axisProps = { tick: { fill: INK.muted, fontSize: 11 }, tickLine: false, axisLine: { stroke: AXIS } };
  const tooltip = <Tooltip content={<ChartTooltip spec={spec} full={full} />} cursor={chart.includes('bar') ? { fill: 'rgba(15,23,42,0.04)' } : { stroke: AXIS, strokeWidth: 1 }} />;
  const color = (i) => SERIES[i % SERIES.length];
  const margin = { top: 8, right: chart === 'line' && series.length <= 4 ? 56 : 16, bottom: chart === 'scatter' ? 16 : 4, left: 4 };

  if (chart === 'pie') {
    const key = series[0].key;
    return (
      <PieChart>
        {tooltip}
        <Pie data={data} dataKey={key} nameKey={x.key} innerRadius="55%" outerRadius="85%" stroke={SURFACE} strokeWidth={2} isAnimationActive={false}>
          {data.map((d, i) => <Cell key={i} fill={sliceColor(d, x.key, i)} />)}
        </Pie>
      </PieChart>
    );
  }
  if (chart === 'horizontal_bar') {
    // Category labels get at most ~35% of the plot width, so bars stay visible on phones.
    const maxChars = Math.max(8, Math.min(28, Math.floor(((width || 600) * 0.35 - 16) / 6.2)));
    const longest = Math.min(maxChars, Math.max(...data.map((d) => String(d[x.key]).length)));
    return (
      <BarChart data={data} layout="vertical" margin={margin} barGap={2}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" {...axisProps} tickFormatter={compact} />
        <YAxis type="category" dataKey={x.key} {...axisProps} width={16 + longest * 6.2} interval={0}
          tick={<CategoryTick maxChars={maxChars} />} />
        {tooltip}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={color(i)} stackId={stack} maxBarSize={24}
            radius={!stack || i === series.length - 1 ? [0, 4, 4, 0] : 0} stroke={stack ? SURFACE : undefined} strokeWidth={stack ? 2 : 0} isAnimationActive={false} />
        ))}
      </BarChart>
    );
  }
  if (chart === 'bar') {
    return (
      <BarChart data={data} margin={margin} barGap={2}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey={x.key} {...axisProps} />
        <YAxis {...axisProps} tickFormatter={compact} width={56} />
        {tooltip}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={color(i)} stackId={stack} maxBarSize={24}
            radius={!stack || i === series.length - 1 ? [4, 4, 0, 0] : 0} stroke={stack ? SURFACE : undefined} strokeWidth={stack ? 2 : 0} isAnimationActive={false} />
        ))}
      </BarChart>
    );
  }
  if (chart === 'line') {
    return (
      <LineChart data={data} margin={margin}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey={x.key} {...axisProps} />
        <YAxis {...axisProps} tickFormatter={compact} width={56} />
        {tooltip}
        {series.map((s, i) => (
          <Line key={s.key} dataKey={s.key} name={s.label} stroke={color(i)} strokeWidth={2} dot={false} connectNulls
            activeDot={{ r: 5, stroke: SURFACE, strokeWidth: 2 }} isAnimationActive={false}>
            {series.length <= 4 && <LabelList dataKey={s.key} content={endLabel(data.length - 1, compact)} />}
          </Line>
        ))}
      </LineChart>
    );
  }
  if (chart === 'area') {
    return (
      <AreaChart data={data} margin={margin}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey={x.key} {...axisProps} />
        <YAxis {...axisProps} tickFormatter={compact} width={56} />
        {tooltip}
        {series.map((s, i) => (
          <Area key={s.key} dataKey={s.key} name={s.label} stroke={color(i)} strokeWidth={2} fill={color(i)} fillOpacity={0.1}
            stackId={stack} activeDot={{ r: 5, stroke: SURFACE, strokeWidth: 2 }} isAnimationActive={false} />
        ))}
      </AreaChart>
    );
  }
  // scatter: x and every series are numeric; each series is mapped onto shared __x/__y keys
  return (
    <ScatterChart margin={margin}>
      <CartesianGrid stroke={GRID} />
      <XAxis type="number" dataKey="__x" name={x.label} {...axisProps}
        tickFormatter={(v) => new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(v)}
        label={{ value: x.label, position: 'insideBottom', offset: -2, fill: INK.secondary, fontSize: 11 }} />
      <YAxis type="number" dataKey="__y" {...axisProps} tickFormatter={compact} width={56} />
      <ZAxis range={[64, 64]} />
      {tooltip}
      {series.map((s, i) => (
        <Scatter key={s.key} name={s.label} fill={color(i)} stroke={SURFACE} strokeWidth={2} isAnimationActive={false}
          data={data.filter((d) => d[s.key] != null).map((d) => ({ __x: d[x.key], __y: d[s.key], __series: s.label, __color: color(i) }))} />
      ))}
    </ScatterChart>
  );
}

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

export default function AssistantChart({ source }) {
  const [showData, setShowData] = useState(false);
  const [plotRef, width] = useWidth();
  const { spec, error } = parseChartSpec(source);
  if (error) {
    return (
      <div className="my-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
        <div className="font-semibold">Chart could not be displayed</div>
        <div className="mt-0.5">{error}</div>
      </div>
    );
  }
  const compact = formatter(spec.unit, true);
  const full = formatter(spec.unit, false);
  const legend = spec.chart === 'pie'
    ? spec.data.map((d, i) => ({ label: `${d[spec.x.key]} · ${full(d[spec.series[0].key])}`, color: sliceColor(d, spec.x.key, i) }))
    : spec.series.length > 1 ? spec.series.map((s, i) => ({ label: s.label, color: SERIES[i % SERIES.length] })) : null;

  return (
    <figure className="my-3 rounded-xl border border-slate-200 bg-white p-4 not-prose">
      <figcaption className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold" style={{ color: INK.primary }}>{spec.title}</div>
          {spec.subtitle && <div className="text-xs mt-0.5" style={{ color: INK.secondary }}>{spec.subtitle}</div>}
        </div>
        <button
          type="button"
          onClick={() => setShowData((v) => !v)}
          className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          aria-expanded={showData}
        >
          {showData ? 'Hide data' : 'Show data'}
        </button>
      </figcaption>
      {legend && <div className="mb-2"><Legend items={legend} /></div>}
      <div ref={plotRef} className="h-64 w-full" role="img" aria-label={`${spec.title}. ${spec.data.length} data points; use Show data for the values.`}>
        <ResponsiveContainer width="100%" height="100%">
          {/* call, don't nest: ResponsiveContainer sizes its direct child, which must be the recharts chart */}
          {Plot({ spec, compact, full, width })}
        </ResponsiveContainer>
      </div>
      {showData && <DataTable spec={spec} full={full} />}
    </figure>
  );
}
