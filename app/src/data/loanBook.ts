/**
 * LoanLens has no backend: the loan book is mock data shipped with the app
 * (public/data/loans.json), fetched once and summarised in the browser.
 */
import type { Loan, LoanType, Summary } from '../lib/loans';
import { monthlyEmi } from './emi';

export const LOAN_TYPES: readonly LoanType[] = ['home', 'personal', 'car', 'education'];
export const LOAN_BOOK_URL = '/data/loans.json';

let book: Promise<Loan[]> | undefined;

export function loadLoans(): Promise<Loan[]> {
  book ??= fetch(LOAN_BOOK_URL).then((res) => {
    if (!res.ok) throw new Error(`The loan book could not be loaded (HTTP ${res.status}).`);
    return res.json() as Promise<Loan[]>;
  });
  // A failed load is not cached, so the next visit tries again.
  book.catch(() => {
    book = undefined;
  });
  return book;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

export function summarise(loans: Loan[]): Summary {
  const totalPrincipal = sum(loans.map((l) => l.amount));
  const repaying = loans.filter((l) => l.status === 'active' || l.status === 'overdue');
  return {
    count: loans.length,
    activeCount: loans.filter((l) => l.status === 'active').length,
    totalPrincipal,
    weightedAverageRate: totalPrincipal ? round2(sum(loans.map((l) => l.amount * l.rate)) / totalPrincipal) : 0,
    monthlyEmiInflow: round2(sum(repaying.map((l) => round2(monthlyEmi(l.amount, l.rate, l.tenureMonths))))),
    byType: LOAN_TYPES.map((type) => ({ type, principal: sum(loans.filter((l) => l.type === type).map((l) => l.amount)) })),
  };
}

/** The newest disbursements first; ties broken by loan id so the order is stable. */
export function recentLoans(loans: Loan[], count: number): Loan[] {
  return [...loans].sort((a, b) => b.disbursedOn.localeCompare(a.disbursedOn) || a.id.localeCompare(b.id)).slice(0, count);
}
