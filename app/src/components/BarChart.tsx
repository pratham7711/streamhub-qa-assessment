import { useId } from 'react';

export interface Segment {
  key: string;
  label: string;
  value: number;
  color: string;
}

export interface Bar {
  key: string;
  label: string;
  segments: Segment[];
}

interface Props {
  title: string;
  description?: string;
  bars: Bar[];
  format: (value: number) => string;
  formatAxis: (value: number) => string;
  legend: { key: string; label: string; color: string }[];
}

const W = 960;
const H = 280;
const M = { top: 12, right: 8, bottom: 30, left: 64 };
const TICKS = 4;

/** A round axis maximum: the smallest 1-1.5-2-2.5-…-10 step that covers the tallest bar. */
function niceMax(value: number): number {
  if (value <= 0) return TICKS;
  const raw = value / TICKS;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => s * magnitude >= raw) ?? 10;
  return step * magnitude * TICKS;
}

/** Stacked vertical bar chart. Each bar is a named image whose label carries its values. */
export function BarChart({ title, description, bars, format, formatAxis, legend }: Props) {
  const id = useId();
  const totals = bars.map((b) => b.segments.reduce((s, seg) => s + seg.value, 0));
  const max = niceMax(Math.max(0, ...totals));
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const slot = plotW / Math.max(1, bars.length);
  const barW = Math.min(48, slot * 0.62);
  const labelEvery = Math.ceil(bars.length / 16);
  const y = (v: number) => M.top + plotH - (v / max) * plotH;
  const ticks = Array.from({ length: TICKS + 1 }, (_, i) => (i / TICKS) * max);

  return (
    <figure className="chart bars" aria-labelledby={`${id}-title`} aria-describedby={description ? `${id}-desc` : undefined}>
      <figcaption className="chart-head">
        <span id={`${id}-title`} className="chart-title">
          {title}
        </span>
        <ul className="chart-legend" aria-label={`${title} legend`}>
          {legend.map((l) => (
            <li key={l.key}>
              <span className="swatch" style={{ background: l.color }} aria-hidden="true" />
              {l.label}
            </li>
          ))}
        </ul>
      </figcaption>
      {description && (
        <p id={`${id}-desc`} className="chart-desc">
          {description}
        </p>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="group" aria-label={`${title} chart`}>
        <g aria-hidden="true" className="axis">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={M.left + plotW} y1={y(t)} y2={y(t)} className={t === 0 ? 'baseline' : 'gridline'} />
              <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
                {formatAxis(t)}
              </text>
            </g>
          ))}
          {bars.map((b, i) =>
            i % labelEvery === 0 ? (
              <text key={b.key} x={M.left + slot * i + slot / 2} y={H - 10} textAnchor="middle">
                {b.label}
              </text>
            ) : null,
          )}
        </g>
        {bars.map((b, i) => {
          const x = M.left + slot * i + (slot - barW) / 2;
          let stacked = 0;
          const name = `${b.label}: ${b.segments.map((s) => `${s.label} ${format(s.value)}`).join(', ')}, total ${format(totals[i])}`;
          return (
            <g key={b.key} role="img" aria-label={name} data-key={b.key} data-value={totals[i]} className="bar">
              {b.segments.map((s) => {
                const top = y(stacked + s.value);
                const h = y(stacked) - top;
                stacked += s.value;
                return <rect key={s.key} x={x} y={top} width={barW} height={Math.max(0, h)} fill={s.color} data-segment={s.key} data-value={s.value} rx={1.5} />;
              })}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
