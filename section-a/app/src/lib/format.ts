const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const grouped = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** ₹1,07,96,711 — Indian digit grouping, rounded to the rupee. */
export function inr(value: number): string {
  return rupees.format(Math.round(value));
}

export function groupedNumber(value: number): string {
  return grouped.format(Math.round(value));
}

/** Short axis labels: ₹2.5 Cr, ₹45 L, ₹80 K. */
export function inrShort(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e7) return `₹${trim(value / 1e7)} Cr`;
  if (abs >= 1e5) return `₹${trim(value / 1e5)} L`;
  if (abs >= 1e3) return `₹${trim(value / 1e3)} K`;
  return `₹${Math.round(value)}`;
}

/** Words for an amount the way Indian lenders say it: "25 lakh", "1.2 crore". */
export function inrWords(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  if (value >= 1e7) return `${trim(value / 1e7)} crore`;
  if (value >= 1e5) return `${trim(value / 1e5)} lakh`;
  if (value >= 1e3) return `${trim(value / 1e3)} thousand`;
  return `${Math.round(value)}`;
}

function trim(n: number): string {
  return n.toFixed(2).replace(/\.?0+$/, '');
}

export function percent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

export function rate(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function tenure(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (!years) return `${rest} mo`;
  return rest ? `${years} yr ${rest} mo` : `${years} yr`;
}

const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export function date(iso: string): string {
  return dateFormat.format(new Date(`${iso}T00:00:00Z`));
}

const monthFormat = new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });
export function monthYear(isoMonth: string): string {
  return monthFormat.format(new Date(`${isoMonth}-01T00:00:00Z`));
}
