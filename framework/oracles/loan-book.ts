/**
 * Test oracle for LoanLens data. Reads the mock data file directly and
 * re-implements the documented query semantics (filter, search, sort, page,
 * summarise) without importing any application code, so API and UI results can
 * be compared with an independently computed expectation.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expectedEmi } from './emi.js';

export interface BookLoan {
  id: string;
  borrower: string;
  type: string;
  amount: number;
  rate: number;
  tenureMonths: number;
  disbursedOn: string;
  status: string;
  city: string;
}

let file: string | undefined;
let cache: BookLoan[] | undefined;

/**
 * Each app reads its own copy of the mock data, so the oracle is pointed at the copy the app
 * under test reads (framework/support/hooks.ts does it per scenario, from the @web-app or
 * @api-app tag): section-a/app/public/data/loans.json or section-b/api/data/loans.json.
 */
export function setLoanBookFile(dataFile: string): void {
  if (file !== dataFile) cache = undefined;
  file = dataFile;
}

export function loanBook(): BookLoan[] {
  if (!file) throw new Error('No loan book chosen: tag the scenario @web-app or @api-app, or call setLoanBookFile()');
  cache ??= JSON.parse(readFileSync(path.resolve(file), 'utf8')) as BookLoan[];
  return cache;
}

export const DEFAULT_SORT = '-disbursedOn';
export const DEFAULT_PAGE_SIZE = 10;

export function emiOf(loan: BookLoan): number {
  return expectedEmi({ principal: loan.amount, annualRatePct: loan.rate, months: loan.tenureMonths }).emi;
}

export function filterBook(params: URLSearchParams): BookLoan[] {
  // getAll, not get: "type=home&type=car" must merge both values, as the API documents.
  const list = (key: string) => {
    const values = params.getAll(key).flatMap((v) => v.split(',')).map((s) => s.trim()).filter(Boolean);
    return values.length ? values : undefined;
  };
  const num = (key: string) => (params.has(key) ? Number(params.get(key)) : undefined);
  const types = list('type');
  const statuses = list('status');
  const cities = list('city');
  const [minAmount, maxAmount, minRate, maxRate] = ['minAmount', 'maxAmount', 'minRate', 'maxRate'].map(num);
  const from = params.get('disbursedFrom');
  const to = params.get('disbursedTo');
  const q = params.get('q')?.toLowerCase();

  return loanBook().filter(
    (l) =>
      (!types || types.includes(l.type)) &&
      (!statuses || statuses.includes(l.status)) &&
      (!cities || cities.includes(l.city)) &&
      (minAmount === undefined || l.amount >= minAmount) &&
      (maxAmount === undefined || l.amount <= maxAmount) &&
      (minRate === undefined || l.rate >= minRate) &&
      (maxRate === undefined || l.rate <= maxRate) &&
      (!from || l.disbursedOn >= from) &&
      (!to || l.disbursedOn <= to) &&
      (!q || l.borrower.toLowerCase().includes(q) || l.id.toLowerCase().includes(q)),
  );
}

export function sortBook(loans: BookLoan[], sort = DEFAULT_SORT): BookLoan[] {
  const descending = sort.startsWith('-');
  const field = descending ? sort.slice(1) : sort;
  const value = (l: BookLoan) => (field === 'emi' ? emiOf(l) : (l as unknown as Record<string, string | number>)[field]);
  return [...loans].sort((a, b) => {
    const av = value(a);
    const bv = value(b);
    const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return (descending ? -cmp : cmp) || a.id.localeCompare(b.id);
  });
}

export function expectedPage(query: string) {
  const params = new URLSearchParams(query);
  const matching = sortBook(filterBook(params), params.get('sort') ?? DEFAULT_SORT);
  const page = Number(params.get('page') ?? 1);
  const pageSize = Number(params.get('pageSize') ?? DEFAULT_PAGE_SIZE);
  return {
    total: matching.length,
    totalPages: Math.max(1, Math.ceil(matching.length / pageSize)),
    ids: matching.slice((page - 1) * pageSize, page * pageSize).map((l) => l.id),
  };
}

export function expectedSummary(query: string) {
  const loans = filterBook(new URLSearchParams(query));
  const totalPrincipal = loans.reduce((s, l) => s + l.amount, 0);
  const tally = (key: 'type' | 'status', value: string) => {
    const members = loans.filter((l) => l[key] === value);
    return { count: members.length, principal: members.reduce((s, l) => s + l.amount, 0) };
  };
  return {
    count: loans.length,
    totalPrincipal,
    weightedAverageRate: totalPrincipal ? loans.reduce((s, l) => s + l.amount * l.rate, 0) / totalPrincipal : 0,
    // A borrower pays the EMI as quoted, to the paisa, so the inflow is the sum of quoted EMIs.
    monthlyEmiInflow: loans.filter((l) => l.status === 'active' || l.status === 'overdue').reduce((s, l) => s + Math.round(emiOf(l) * 100) / 100, 0),
    byType: Object.fromEntries(['home', 'personal', 'car', 'education'].map((t) => [t, tally('type', t)])),
    byStatus: Object.fromEntries(['active', 'closed', 'overdue', 'pending'].map((s) => [s, tally('status', s)])),
  };
}
