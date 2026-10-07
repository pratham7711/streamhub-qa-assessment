/**
 * Strict readers for the two text formats the UI uses for tenure and dates. They parse
 * what is on screen back into data instead of re-running the app's formatter, so a
 * formatter that drops the remainder months or shifts a date by a day is caught.
 */

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

/** "7 yr 6 mo" -> 90, "15 yr" -> 180, "9 mo" -> 9. Anything else throws. */
export function readTenureMonths(text: string): number {
  const match = text.trim().match(/^(?:(\d+) yr)?(?: ?(\d+) mo)?$/);
  if (!match || (match[1] === undefined && match[2] === undefined)) throw new Error(`Not a tenure: "${text}"`);
  const months = Number(match[2] ?? 0);
  if (months > 11) throw new Error(`Tenure "${text}" shows ${months} months; whole years belong in "yr"`);
  return Number(match[1] ?? 0) * 12 + months;
}

/** "24 Sept 2025" or "24 Sep 2025" -> "2025-09-24". Anything else throws. */
export function readDisplayDate(text: string): string {
  const match = text.trim().match(/^(\d{1,2}) ([A-Za-z]{3,4}) (\d{4})$/);
  const month = match ? MONTHS[match[2].toLowerCase()] : undefined;
  if (!match || !month) throw new Error(`Not a date: "${text}"`);
  const day = Number(match[1]);
  const iso = `${match[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const check = new Date(`${iso}T00:00:00Z`);
  if (check.getUTCDate() !== day || check.getUTCMonth() + 1 !== month) throw new Error(`No such date: "${text}"`);
  return iso;
}
