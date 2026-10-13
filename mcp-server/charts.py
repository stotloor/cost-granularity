"""Chart specs for the create_chart MCP tool.

A chart travels as a small JSON spec ("cg-chart" v1), not an image: the agent copies
it into its reply inside a ```chart fenced block and the client renders it. The spec
carries data plus intent (form, axes, unit); colors and styling belong to the
renderer, so every client draws charts consistently.

    {"type": "cg-chart", "version": 1, "chart": "bar", "title": "...", "subtitle": "...",
     "x": {"key": "project", "label": "Project"},
     "series": [{"key": "ytd", "label": "YTD actual"}],
     "unit": "gbp", "stacked": false, "data": [{"project": "GT-P0280", "ytd": 1234.5}, ...]}

Form rules enforced here (so a bad chart is impossible, not just discouraged): one
y-axis and one unit; at most 8 series (categorical palette size); scatter at most 3
series; pie at most 6 slices with the tail folded into "Other"; pie needs exactly
one non-negative series.
"""
from __future__ import annotations

import json
from typing import Any

CHART_TYPES = ('bar', 'horizontal_bar', 'line', 'area', 'pie', 'scatter')
UNITS = ('gbp', 'percent', 'number')
MAX_POINTS = 500
MAX_CATEGORIES = 60          # bar charts: beyond this, aggregate or take a top N
MAX_SERIES = 8
MAX_SCATTER_SERIES = 3
MAX_PIE_SLICES = 6
MAX_SPEC_BYTES = 24_000      # keep the block small enough for the agent to copy verbatim


class ChartError(ValueError):
    pass


def build_chart(chart_type: str, title: str, columns: list[str], rows: list[list[Any]],
                x: str, y: list[str], series_labels: list[str] | None = None,
                x_label: str | None = None, unit: str = 'number', stacked: bool = False,
                subtitle: str | None = None) -> dict:
    chart_type = chart_type.strip().lower()
    if chart_type not in CHART_TYPES:
        raise ChartError(f'chart_type must be one of {", ".join(CHART_TYPES)}')
    if unit not in UNITS:
        raise ChartError(f'unit must be one of {", ".join(UNITS)} (one unit per chart: never mix £ and %)')
    if not title or not title.strip():
        raise ChartError('title is required: say what is plotted and for which period')
    if not y:
        raise ChartError('y must name at least one numeric column')
    if len(set(y)) != len(y) or x in y:
        raise ChartError('x and y columns must be distinct')
    missing = [c for c in [x, *y] if c not in columns]
    if missing:
        raise ChartError(f'columns not in the data: {missing}; available: {columns}')
    if series_labels is not None and len(series_labels) != len(y):
        raise ChartError('series_labels must have one label per y column')
    if not rows:
        raise ChartError('no rows to chart')
    if len(rows) > MAX_POINTS:
        raise ChartError(f'{len(rows)} rows is too many to chart (max {MAX_POINTS}); aggregate in SQL first')

    if chart_type == 'pie':
        if len(y) != 1:
            raise ChartError('a pie shows one series; pass exactly one y column')
        if stacked:
            raise ChartError('stacked does not apply to pie')
    if chart_type == 'scatter' and len(y) > MAX_SCATTER_SERIES:
        raise ChartError(f'scatter supports at most {MAX_SCATTER_SERIES} series (more cannot be told apart)')
    if len(y) > MAX_SERIES:
        raise ChartError(f'at most {MAX_SERIES} series; fold the rest into "Other" or split into several charts')
    if stacked and chart_type not in ('bar', 'horizontal_bar', 'area'):
        raise ChartError('stacked applies only to bar, horizontal_bar and area')

    ix = columns.index(x)
    iy = [columns.index(c) for c in y]
    data = []
    for r in rows:
        point = {x: _x_value(r[ix], chart_type)}
        for c, i in zip(y, iy):
            point[c] = _number(r[i], c)
        data.append(point)

    if chart_type in ('bar', 'horizontal_bar') and len(data) > MAX_CATEGORIES:
        raise ChartError(f'{len(data)} categories is too many for a bar chart (max {MAX_CATEGORIES}); '
                         'take a top N and fold the rest into "Other"')
    if chart_type == 'scatter' and any(not isinstance(p[x], (int, float)) for p in data):
        raise ChartError('scatter needs a numeric x column')
    if chart_type == 'pie':
        data = _pie_slices(data, x, y[0])

    labels = series_labels or [_humanise(c) for c in y]
    spec = {
        'type': 'cg-chart', 'version': 1, 'chart': chart_type, 'title': title.strip(),
        **({'subtitle': subtitle.strip()} if subtitle and subtitle.strip() else {}),
        'x': {'key': x, 'label': x_label or _humanise(x)},
        'series': [{'key': c, 'label': lab} for c, lab in zip(y, labels)],
        'unit': unit,
        **({'stacked': True} if stacked else {}),
        'data': data,
    }
    if len(to_json(spec)) > MAX_SPEC_BYTES:
        raise ChartError('chart data is too large to embed in a reply; aggregate further or chart fewer points')
    return spec


def to_json(spec: dict) -> str:
    return json.dumps(spec, separators=(',', ':'), ensure_ascii=False)


def to_markdown(spec: dict) -> str:
    return '```chart\n' + to_json(spec) + '\n```'


def _number(v: Any, column: str) -> float | int | None:
    if v is None:
        return None
    if isinstance(v, bool):
        raise ChartError(f'column {column!r} is boolean, not numeric')
    if isinstance(v, (int, float)):
        return round(v, 2) if isinstance(v, float) else v
    try:
        f = float(str(v).replace(',', '').replace('£', ''))
    except ValueError:
        raise ChartError(f'column {column!r} has non-numeric value {v!r}') from None
    return int(f) if f.is_integer() else round(f, 2)


def _x_value(v: Any, chart_type: str) -> Any:
    if chart_type == 'scatter':
        return _number(v, 'x')
    if v is None:
        return '(blank)'
    return v if isinstance(v, (int, float, str)) else str(v)


def _pie_slices(data: list[dict], x: str, key: str) -> list[dict]:
    if any(p[key] is not None and p[key] < 0 for p in data):
        raise ChartError('a pie cannot show negative values; use a bar chart')
    data = sorted((p for p in data if p[key]), key=lambda p: p[key], reverse=True)
    if len(data) < 2:
        raise ChartError('a pie needs at least 2 non-zero slices; report a single number instead')
    if len(data) > MAX_PIE_SLICES:
        head, tail = data[:MAX_PIE_SLICES - 1], data[MAX_PIE_SLICES - 1:]
        data = head + [{x: f'Other ({len(tail)})', key: round(sum(p[key] for p in tail), 2)}]
    return data


def _humanise(name: str) -> str:
    s = str(name).replace('_', ' ').strip()
    return s[:1].upper() + s[1:]
