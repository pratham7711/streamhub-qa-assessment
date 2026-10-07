import type { ReactNode } from 'react';
import { STATUS_LABEL, type LoanStatus } from '../lib/loans';

export function StatusBadge({ status }: { status: LoanStatus }) {
  return (
    <span className={`badge badge-${status}`}>
      <span className="badge-dot" aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export interface Kpi {
  label: string;
  value: string;
  note?: string;
}

/** KPI strip as a description list; each KPI is a group named by its label. */
export function KpiStrip({ items, label, busy }: { items: Kpi[]; label: string; busy?: boolean }) {
  return (
    <dl className="kpis" aria-label={label} aria-busy={busy}>
      {items.map((k) => {
        const id = `kpi-${k.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        return (
          <div className="kpi" role="group" aria-labelledby={id} key={k.label}>
            <dt id={id}>{k.label}</dt>
            <dd className="kpi-value" data-testid="kpi-value">
              {k.value}
            </dd>
            {k.note && <dd className="kpi-note">{k.note}</dd>}
          </div>
        );
      })}
    </dl>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={`panel ${className ?? ''}`}>{children}</section>;
}

export function Skeleton({ height = 200, label = 'Loading' }: { height?: number; label?: string }) {
  return (
    <div className="skeleton" style={{ height }} role="status" aria-label={label}>
      <span className="sr-only">{label}…</span>
    </div>
  );
}

export function ErrorNote({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="error-note" role="alert">
      <p className="error-title">{title}</p>
      {children}
    </div>
  );
}

export function PageHeader({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {children && <p className="page-lede">{children}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
