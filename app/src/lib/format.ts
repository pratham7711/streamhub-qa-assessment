const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const grouped = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** ₹1,07,96,711: Indian digit grouping, rounded to the rupee. */
export function inr(value: number): string {
  return rupees.format(Math.round(value));
}

export function groupedNumber(value: number): string {
  return grouped.format(Math.round(value));
}

/** Short axis labels: ₹2.5 Cr, ₹45 L, ₹80 K. */
export function inrShort(value: number): string {
  const trim = (n: number) => n.toFixed(2).replace(/\.?0+$/, '');
  const abs = Math.abs(value);
  if (abs >= 1e7) return `₹${trim(value / 1e7)} Cr`;
  if (abs >= 1e5) return `₹${trim(value / 1e5)} L`;
  if (abs >= 1e3) return `₹${trim(value / 1e3)} K`;
  return `₹${Math.round(value)}`;
}

export function rate(value: number): string {
  return `${value.toFixed(2)}%`;
}

const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export function date(iso: string): string {
  return dateFormat.format(new Date(`${iso}T00:00:00Z`));
}
