'use client';

import React, { useState } from 'react';
import { Label } from 'recharts';
import { NavIcon } from './nav-icon';
import { colors, gridStroke } from '@/lib/ledger/constants';
import { Row } from '@/lib/ledger/types';

// ── Chart Primitives ──────────────────────────────────────────────────────────

export function ChartBox({ children, height = 240 }: { children: React.ReactNode; height?: number }) {
  return <div className="h-[var(--chart-h)] w-full" style={{ '--chart-h': `${height}px` } as React.CSSProperties}>{children}</div>;
}

export function AxisLabel({ value, axis = 'x' }: { value: string; axis?: 'x' | 'y' }) {
  return (
    <Label
      value={value}
      position={axis === 'x' ? 'insideBottom' : 'insideLeft'}
      angle={axis === 'y' ? -90 : 0}
      offset={axis === 'x' ? -4 : 8}
      style={{ fill: colors.muted, fontSize: 10, letterSpacing: 0 }}
    />
  );
}

export function SparkBox({ children }: { children: React.ReactNode }) {
  return <div className="h-24 w-full">{children}</div>;
}

export function ChartPlaceholder({ children = 'Log your first entry to see trends here' }: { children?: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center rounded-2xl border border-dashed bg-background/55 p-4 text-center text-sm text-[var(--muted)]">
      <div>
        <span className="empty-state-icon mx-auto mb-3"><NavIcon name="chart" className="h-4 w-4" /></span>
        <div>{children}</div>
      </div>
    </div>
  );
}

export function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name?: string; value?: number | string; color?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border bg-card px-3 py-2 text-xs shadow-sm">
      {label ? <div className="mb-1 font-medium text-ink">{label}</div> : null}
      {payload.map((item) => (
        <div key={`${item.name}-${item.value}`} className="flex items-center gap-2 text-[var(--muted)]">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color ?? colors.brass }} />
          <span>{item.name}: {item.value}</span>
        </div>
      ))}
    </div>
  );
}

export function Heatmap({ days, compact = false }: { days: { date: string; count: number }[]; compact?: boolean }) {
  const tone = (count: number) => {
    if (count >= 4) return 'bg-brass';
    if (count >= 2) return 'bg-brass/65';
    if (count === 1) return 'bg-brass/30';
    return 'bg-card';
  };

  return (
    <div className={`grid grid-flow-col grid-rows-7 gap-1 overflow-x-auto pb-1 ${compact ? 'max-w-full' : ''}`}>
      {days.map((day) => (
        <div
          key={day.date}
          title={`${day.date}: ${day.count} logged module${day.count === 1 ? '' : 's'}`}
          className={`${compact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'} shrink-0 rounded-[3px] border border-rule ${tone(day.count)} hover:border-brass`}
        />
      ))}
    </div>
  );
}

// ── Custom SVG Trend Chart ────────────────────────────────────────────────────

export function SvgCanvasTrendChart({
  data,
  valueKey,
  unit = '',
  strokeColor = colors.brass,
  fillGradientId = 'trendGradient',
  referenceValue,
  referenceLabel = 'Target',
  height = 200,
}: {
  data: Row[];
  valueKey: string;
  unit?: string;
  strokeColor?: string;
  fillGradientId?: string;
  referenceValue?: number;
  referenceLabel?: string;
  height?: number;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!data || !data.length) {
    return <ChartPlaceholder>No data points logged to display trend chart.</ChartPlaceholder>;
  }

  const values = data.map((d) => Number(d[valueKey] ?? 0));
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const minVal = referenceValue !== undefined ? Math.min(rawMin, referenceValue) : rawMin;
  const maxVal = referenceValue !== undefined ? Math.max(rawMax, referenceValue) : rawMax;
  const spread = maxVal - minVal || 1;
  const padding = { top: 25, bottom: 30, left: 48, right: 20 };
  const chartWidth = 650;
  const chartHeight = height;

  const points = data.map((d, i) => {
    const val = Number(d[valueKey] ?? 0);
    const x = padding.left + (i / Math.max(data.length - 1, 1)) * (chartWidth - padding.left - padding.right);
    const y = chartHeight - padding.bottom - ((val - minVal) / spread) * (chartHeight - padding.top - padding.bottom);
    return { x, y, val, date: String(d.date) };
  });

  let pathD = '';
  if (points.length === 1) {
    pathD = `M ${padding.left} ${points[0].y} L ${chartWidth - padding.right} ${points[0].y}`;
  } else {
    pathD = points.reduce((acc, p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = points[i - 1];
      const cx1 = prev.x + (p.x - prev.x) / 2;
      const cy1 = prev.y;
      const cx2 = prev.x + (p.x - prev.x) / 2;
      const cy2 = p.y;
      return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p.x} ${p.y}`;
    }, '');
  }

  const areaD = `${pathD} L ${points[points.length - 1].x} ${chartHeight - padding.bottom} L ${points[0].x} ${chartHeight - padding.bottom} Z`;

  let refY: number | null = null;
  if (referenceValue !== undefined && Number.isFinite(referenceValue)) {
    refY = chartHeight - padding.bottom - ((referenceValue - minVal) / spread) * (chartHeight - padding.top - padding.bottom);
  }

  const activePoint = hoverIndex !== null ? points[hoverIndex] : points[points.length - 1];
  const firstPoint = points[0];
  const delta = activePoint && firstPoint ? activePoint.val - firstPoint.val : 0;

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b pb-3 text-xs text-[var(--muted)]">
        <div className="flex items-center gap-3">
          <span className="font-medium text-ink">
            Current: <strong className="text-sm font-semibold tabular-nums text-brass">{activePoint ? `${activePoint.val.toFixed(1)} ${unit}`.trim() : '-'}</strong>
          </span>
          {delta !== 0 ? (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${delta > 0 ? 'bg-moss/10 text-moss' : 'bg-wax/10 text-wax'}`}>
              {delta > 0 ? '↑ +' : '↓ '}{delta.toFixed(1)} {unit}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span>Min: <strong className="tabular-nums text-ink">{minVal.toFixed(1)}</strong></span>
          <span>Max: <strong className="tabular-nums text-ink">{maxVal.toFixed(1)}</strong></span>
        </div>
      </div>

      <div className="relative w-full" style={{ height: `${chartHeight}px` }}>
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="h-full w-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={fillGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={0.28} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0.01} />
            </linearGradient>
          </defs>

          {[0, 0.33, 0.66, 1].map((ratio, idx) => {
            const y = padding.top + ratio * (chartHeight - padding.top - padding.bottom);
            const val = maxVal - ratio * spread;
            return (
              <g key={`grid-${idx}`}>
                <line x1={padding.left} y1={y} x2={chartWidth - padding.right} y2={y} stroke={gridStroke} strokeDasharray="3 3" />
                <text x={padding.left - 6} y={y + 3} textAnchor="end" fontSize="10" fill={colors.muted}>
                  {val.toFixed(0)}
                </text>
              </g>
            );
          })}

          {refY !== null && (
            <g>
              <line x1={padding.left} y1={refY} x2={chartWidth - padding.right} y2={refY} stroke={colors.moss} strokeWidth="1.5" strokeDasharray="4 4" />
              <text x={chartWidth - padding.right} y={refY - 4} textAnchor="end" fontSize="10" fontWeight="600" fill={colors.moss}>
                {referenceLabel}: {referenceValue} {unit}
              </text>
            </g>
          )}

          <path d={areaD} fill={`url(#${fillGradientId})`} />
          <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {points.map((p, i) => {
            const isHovered = hoverIndex === i || (hoverIndex === null && i === points.length - 1);
            return (
              <g key={`pt-${i}`} className="cursor-pointer">
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 4.5 : points.length > 25 ? 0 : 2}
                  fill={isHovered ? strokeColor : 'white'}
                  stroke={strokeColor}
                  strokeWidth={isHovered ? 3 : 1.5}
                />
                <rect
                  x={p.x - chartWidth / Math.max(points.length, 1) / 2}
                  y={0}
                  width={chartWidth / Math.max(points.length, 1)}
                  height={chartHeight}
                  fill="transparent"
                  onMouseEnter={() => setHoverIndex(i)}
                  onMouseLeave={() => setHoverIndex(null)}
                />
              </g>
            );
          })}
        </svg>

        {activePoint && hoverIndex !== null && (
          <div
            className="pointer-events-none absolute z-20 rounded-xl border border-rule bg-card/95 px-3 py-1.5 text-xs shadow-md backdrop-blur-md transition-all duration-150"
            style={{
              left: `${Math.min(Math.max(activePoint.x - 40, 10), chartWidth - 90)}px`,
              top: `${Math.max(activePoint.y - 42, 5)}px`,
            }}
          >
            <div className="font-semibold text-ink">{activePoint.date}</div>
            <div className="text-slate-600 font-medium">{activePoint.val.toFixed(2)} {unit}</div>
          </div>
        )}
      </div>
    </div>
  );
}
