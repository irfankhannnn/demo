import { useId, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { cn, formatCompact, formatDate, formatNumber } from '../lib/format';

/**
 * Hand-rolled inline SVG charts.
 *
 * real-estate-crm-app does not depend on recharts (or any charting library), so
 * pulling one in here would make this app the odd sibling and add ~450 kB to a
 * bundle whose whole job is six screens of tables. Two components cover
 * everything the brief needs: a cell-sized `Sparkline` and a full-width
 * `TrendChart` with axes and a hover readout.
 */

export interface TrendPoint {
  /** ISO date, or anything `new Date()` accepts. Used for the x-axis label. */
  date: string;
  value: number;
}

interface Geometry {
  path: string;
  areaPath: string;
  coords: Array<{ x: number; y: number; point: TrendPoint }>;
  min: number;
  max: number;
}

function buildGeometry(
  points: TrendPoint[],
  width: number,
  height: number,
  padding: { top: number; right: number; bottom: number; left: number },
): Geometry | null {
  if (points.length === 0) return null;

  const values = points.map((p) => (Number.isFinite(p.value) ? p.value : 0));
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);

  // A flat series would divide by zero; give it a band so the line sits mid-height.
  const span = rawMax - rawMin;
  const min = span === 0 ? rawMin - 1 : rawMin;
  const max = span === 0 ? rawMax + 1 : rawMax;

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const step = points.length === 1 ? 0 : innerWidth / (points.length - 1);

  const coords = points.map((point, index) => {
    const value = Number.isFinite(point.value) ? point.value : 0;
    const x = padding.left + (points.length === 1 ? innerWidth / 2 : index * step);
    const y = padding.top + innerHeight - ((value - min) / (max - min)) * innerHeight;
    return { x, y, point };
  });

  const path = coords
    .map((c, index) => `${index === 0 ? 'M' : 'L'}${c.x.toFixed(2)},${c.y.toFixed(2)}`)
    .join(' ');

  const baseline = padding.top + innerHeight;
  const areaPath =
    coords.length > 1
      ? `${path} L${coords[coords.length - 1].x.toFixed(2)},${baseline} L${coords[0].x.toFixed(2)},${baseline} Z`
      : '';

  return { path, areaPath, coords, min: rawMin, max: rawMax };
}

/* ------------------------------------------------------------------ */
/* Sparkline — table cells and compact cards                           */
/* ------------------------------------------------------------------ */

interface SparklineProps {
  points: TrendPoint[];
  className?: string;
  /** Stroke colour; defaults to the brand blue. */
  color?: string;
  ariaLabel?: string;
}

export function Sparkline({
  points,
  className,
  color = '#2563EB',
  ariaLabel,
}: SparklineProps) {
  const width = 120;
  const height = 32;
  const geometry = useMemo(
    () => buildGeometry(points, width, height, { top: 3, right: 3, bottom: 3, left: 3 }),
    [points],
  );

  if (!geometry) {
    return (
      <span className={cn('inline-block text-xs text-slate-400', className)}>
        no data
      </span>
    );
  }

  const last = geometry.coords[geometry.coords.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn('h-8 w-[120px]', className)}
      role="img"
      aria-label={ariaLabel ?? `Trend, ${points.length} points`}
    >
      <path
        d={geometry.path}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last.x} cy={last.y} r={2} fill={color} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* TrendChart — the 30-day chart on Overview                           */
/* ------------------------------------------------------------------ */

interface TrendChartProps {
  points: TrendPoint[];
  color?: string;
  className?: string;
  /** Shown in the hover readout, e.g. "enquiries". */
  metricLabel?: string;
  height?: number;
}

const VIEW_WIDTH = 720;

/** Module-level so the geometry memo has a stable dependency. */
const CHART_PADDING = { top: 16, right: 14, bottom: 26, left: 46 };

export function TrendChart({
  points,
  color = '#2563EB',
  className,
  metricLabel = '',
  height = 220,
}: TrendChartProps) {
  const gradientId = useId().replace(/:/g, '');
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const padding = CHART_PADDING;
  const geometry = useMemo(
    () => buildGeometry(points, VIEW_WIDTH, height, CHART_PADDING),
    [points, height],
  );

  if (!geometry) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400',
          className,
        )}
        style={{ height }}
      >
        No trend data for this period yet
      </div>
    );
  }

  const baseline = height - padding.bottom;
  const hovered = hoverIndex === null ? null : geometry.coords[hoverIndex];

  function handleMove(event: ReactMouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg || !geometry) return;
    const rect = svg.getBoundingClientRect();
    const relative = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH;

    let nearest = 0;
    let bestDistance = Infinity;
    geometry.coords.forEach((coord, index) => {
      const distance = Math.abs(coord.x - relative);
      if (distance < bestDistance) {
        bestDistance = distance;
        nearest = index;
      }
    });
    setHoverIndex(nearest);
  }

  const gridValues = [geometry.max, (geometry.max + geometry.min) / 2, geometry.min];
  const first = geometry.coords[0];
  const last = geometry.coords[geometry.coords.length - 1];

  return (
    <div className={cn('relative', className)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
        className="h-auto w-full"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
        role="img"
        aria-label={`${metricLabel || 'Metric'} over the last ${points.length} days`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {gridValues.map((value, index) => {
          const y =
            padding.top +
            (index / (gridValues.length - 1)) * (height - padding.top - padding.bottom);
          return (
            <g key={index}>
              <line
                x1={padding.left}
                x2={VIEW_WIDTH - padding.right}
                y1={y}
                y2={y}
                stroke="#E2E8F0"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={padding.left - 8}
                y={y + 3}
                textAnchor="end"
                className="fill-slate-400"
                style={{ fontSize: 10 }}
              >
                {formatCompact(Math.round(value))}
              </text>
            </g>
          );
        })}

        {geometry.areaPath ? (
          <path d={geometry.areaPath} fill={`url(#${gradientId})`} />
        ) : null}

        <path
          d={geometry.path}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        <circle cx={last.x} cy={last.y} r={3.5} fill={color} />

        {hovered ? (
          <g>
            <line
              x1={hovered.x}
              x2={hovered.x}
              y1={padding.top}
              y2={baseline}
              stroke={color}
              strokeWidth={1}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={hovered.x}
              cy={hovered.y}
              r={4}
              fill="#fff"
              stroke={color}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ) : null}

        <text
          x={first.x}
          y={height - 8}
          textAnchor="start"
          className="fill-slate-400"
          style={{ fontSize: 10 }}
        >
          {formatDate(first.point.date)}
        </text>
        <text
          x={last.x}
          y={height - 8}
          textAnchor="end"
          className="fill-slate-400"
          style={{ fontSize: 10 }}
        >
          {formatDate(last.point.date)}
        </text>
      </svg>

      {hovered ? (
        <div className="pointer-events-none absolute right-2 top-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
          <p className="font-medium text-ink">{formatDate(hovered.point.date)}</p>
          <p className="text-slate-500">
            {formatNumber(hovered.point.value)} {metricLabel}
          </p>
        </div>
      ) : null}
    </div>
  );
}
