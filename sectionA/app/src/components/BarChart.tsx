import { useId, useState } from 'react';
import { useElementWidth } from '../lib/useElementWidth';

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
  /** Extra tooltip lines, e.g. the closing balance. */
  extra?: { label: string; value: string }[];
}

interface Props {
  title: string;
  description?: string;
  bars: Bar[];
  format: (value: number) => string;
  formatAxis: (value: number) => string;
  legend?: { key: string; label: string; color: string }[];
  height?: number;
}

const M = { top: 12, right: 8, bottom: 30, left: 60 };

const TICKS = 4;

function niceMax(value: number): number {
  if (value <= 0) return TICKS;
  const raw = value / TICKS;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => s * magnitude >= raw) ?? 10;
  return step * magnitude * TICKS;
}

/** Vertical (optionally stacked) bar chart. Each bar is a focusable, named mark with a tooltip. */
export function BarChart({ title, description, bars, format, formatAxis, legend, height = 260 }: Props) {
  const id = useId();
  const [setNode, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<string | null>(null);

  const totals = bars.map((b) => b.segments.reduce((s, seg) => s + seg.value, 0));
  const max = niceMax(Math.max(0, ...totals));
  const plotW = Math.max(120, width - M.left - M.right);
  const plotH = height - M.top - M.bottom;
  const slot = plotW / Math.max(1, bars.length);
  const barW = Math.max(4, Math.min(48, slot * 0.62));
  const labelEvery = Math.max(1, Math.ceil(bars.length / Math.max(1, Math.floor(plotW / 44))));
  const y = (v: number) => M.top + plotH - (v / max) * plotH;
  const ticks = Array.from({ length: TICKS + 1 }, (_, i) => (i / TICKS) * max);

  const activeIndex = bars.findIndex((b) => b.key === active);
  const activeBar = activeIndex >= 0 ? bars[activeIndex] : undefined;
  const tooltipLeft = activeIndex >= 0 ? M.left + slot * activeIndex + slot / 2 : 0;

  return (
    <figure className="chart bars" aria-labelledby={`${id}-title`} aria-describedby={description ? `${id}-desc` : undefined}>
      <figcaption className="chart-head">
        <span id={`${id}-title`} className="chart-title">
          {title}
        </span>
        {legend && (
          <ul className="chart-legend" aria-label={`${title} legend`}>
            {legend.map((l) => (
              <li key={l.key}>
                <span className="swatch" style={{ background: l.color }} aria-hidden="true" />
                {l.label}
              </li>
            ))}
          </ul>
        )}
      </figcaption>
      {description && (
        <p id={`${id}-desc`} className="chart-desc">
          {description}
        </p>
      )}
      <div className="bars-body" ref={setNode}>
        <svg width="100%" height={height} role="group" aria-label={`${title} chart`}>
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
                <text key={b.key} x={M.left + slot * i + slot / 2} y={height - 10} textAnchor="middle">
                  {b.label}
                </text>
              ) : null,
            )}
          </g>
          {bars.map((b, i) => {
            const x = M.left + slot * i + (slot - barW) / 2;
            let stacked = 0;
            const total = totals[i];
            const name =
              b.segments.length > 1
                ? `${b.label}: ${b.segments.map((s) => `${s.label} ${format(s.value)}`).join(', ')}, total ${format(total)}`
                : `${b.label}: ${format(total)}`;
            return (
              <g
                key={b.key}
                role="img"
                tabIndex={0}
                aria-label={name}
                aria-describedby={active === b.key ? `${id}-tip` : undefined}
                data-key={b.key}
                data-value={total}
                className={active && active !== b.key ? 'bar is-dimmed' : 'bar'}
                onMouseEnter={() => setActive(b.key)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(b.key)}
                onBlur={() => setActive(null)}
              >
                <rect className="hit" x={M.left + slot * i} y={M.top} width={slot} height={plotH} fill="transparent" />
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
        {activeBar && (
          <div
            id={`${id}-tip`}
            role="tooltip"
            className="tooltip"
            style={{ left: Math.min(Math.max(tooltipLeft, 90), width - 90), top: Math.max(0, y(totals[activeIndex]) - 8) }}
          >
            <p className="tooltip-title">{activeBar.label}</p>
            <dl>
              {activeBar.segments.map((s) => (
                <div key={s.key}>
                  <dt>
                    <span className="swatch" style={{ background: s.color }} aria-hidden="true" />
                    {s.label}
                  </dt>
                  <dd>{format(s.value)}</dd>
                </div>
              ))}
              {activeBar.segments.length > 1 && (
                <div className="tooltip-total">
                  <dt>Total</dt>
                  <dd>{format(totals[activeIndex])}</dd>
                </div>
              )}
              {activeBar.extra?.map((e) => (
                <div key={e.label}>
                  <dt>{e.label}</dt>
                  <dd>{e.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </figure>
  );
}
