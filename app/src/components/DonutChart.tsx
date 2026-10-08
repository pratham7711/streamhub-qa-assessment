import { useId } from 'react';

export interface Slice {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface Props {
  title: string;
  slices: Slice[];
  format: (value: number) => string;
  centerCaption: string;
  centerValue: string;
  /** Header for the legend's value column, e.g. "Principal". */
  valueLabel: string;
}

const R = 92;
const r = 60;
const C = 100;

const point = (radius: number, angle: number) => `${(C + radius * Math.cos(angle)).toFixed(3)} ${(C + radius * Math.sin(angle)).toFixed(3)}`;

function arc(start: number, end: number) {
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${point(R, start)} A ${R} ${R} 0 ${large} 1 ${point(R, end)} L ${point(r, end)} A ${r} ${r} 0 ${large} 0 ${point(r, start)} Z`;
}

/** Donut with a legend table that repeats every value as text and closes on the total. */
export function DonutChart({ title, slices, format, centerCaption, centerValue, valueLabel }: Props) {
  const id = useId();
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const share = (value: number) => (total ? (value / total) * 100 : 0);

  let angle = -Math.PI / 2;
  const marks = slices
    .filter((s) => s.value > 0)
    .map((s) => {
      const sweep = (s.value / total) * Math.PI * 2;
      const start = angle;
      angle += sweep;
      return { ...s, d: arc(start, Math.min(start + sweep, start + Math.PI * 2 - 0.0001)) };
    });

  return (
    <figure className="chart donut" aria-labelledby={`${id}-title`}>
      <figcaption id={`${id}-title`} className="chart-title">
        {title}
      </figcaption>
      <div className="donut-body">
        <svg className="donut-svg" viewBox="0 0 200 200" role="group" aria-label={`${title} chart`}>
          {marks.map((m) => (
            <path key={m.key} d={m.d} fill={m.color} role="img" aria-label={`${m.label}: ${format(m.value)} (${share(m.value).toFixed(1)}%)`} data-key={m.key} data-value={m.value} className="mark" />
          ))}
          <g aria-hidden="true" className="donut-center">
            <text x={C} y={C - 6} textAnchor="middle" className="donut-center-caption">
              {centerCaption}
            </text>
            <text x={C} y={C + 16} textAnchor="middle" className="donut-center-value">
              {centerValue}
            </text>
          </g>
        </svg>
        <table className="legend" aria-label={`${title} values`}>
          <thead>
            <tr>
              <th scope="col">Segment</th>
              <th scope="col" className="num">
                {valueLabel}
              </th>
              <th scope="col" className="num">
                Share
              </th>
            </tr>
          </thead>
          <tbody>
            {slices.map((s) => (
              <tr key={s.key}>
                <th scope="row">
                  <span className="swatch" style={{ background: s.color }} aria-hidden="true" />
                  {s.label}
                </th>
                <td className="num">{format(s.value)}</td>
                <td className="num">{share(s.value).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td className="num">{format(total)}</td>
              <td className="num">100.0%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </figure>
  );
}
