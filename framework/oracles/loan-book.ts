/**
 * Test oracle for the LoanLens dashboard. Reads the mock data file directly and
 * summarises it without importing any application code, so the dashboard's
 * figures are compared with an independently computed expectation.
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
}

export const LOAN_TYPES = ['home', 'personal', 'car', 'education'] as const;

let file: string | undefined;
let cache: BookLoan[] | undefined;

/** Points the oracle at the data the web app reads (framework/support/hooks.ts does it for every @web-app scenario). */
export function setLoanBookFile(dataFile: string): void {
  if (file !== dataFile) cache = undefined;
  file = dataFile;
}

export function loanBook(): BookLoan[] {
  if (!file) throw new Error('No loan book chosen: tag the scenario @web-app, or call setLoanBookFile()');
  cache ??= JSON.parse(readFileSync(path.resolve(file), 'utf8')) as BookLoan[];
  return cache;
}

export function expectedSummary() {
  const loans = loanBook();
  const totalPrincipal = loans.reduce((s, l) => s + l.amount, 0);
  const emi = (l: BookLoan) => expectedEmi({ principal: l.amount, annualRatePct: l.rate, months: l.tenureMonths }).emi;
  return {
    count: loans.length,
    activeCount: loans.filter((l) => l.status === 'active').length,
    totalPrincipal,
    weightedAverageRate: loans.reduce((s, l) => s + l.amount * l.rate, 0) / totalPrincipal,
    // A borrower pays the EMI as quoted, to the paisa, so the inflow is the sum of quoted EMIs.
    monthlyEmiInflow: loans.filter((l) => l.status === 'active' || l.status === 'overdue').reduce((s, l) => s + Math.round(emi(l) * 100) / 100, 0),
    principalByType: Object.fromEntries(LOAN_TYPES.map((t) => [t, loans.filter((l) => l.type === t).reduce((s, l) => s + l.amount, 0)])),
  };
}

/** The newest disbursements first; ties broken by loan id. */
export function mostRecentLoans(count: number): BookLoan[] {
  return [...loanBook()].sort((a, b) => b.disbursedOn.localeCompare(a.disbursedOn) || a.id.localeCompare(b.id)).slice(0, count);
}
