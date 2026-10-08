/**
 * Reducing-balance EMI maths for the calculator and the dashboard's EMI inflow.
 *
 *   EMI = P · r · (1 + r)^n / ((1 + r)^n − 1),   r = annual rate / 12 / 100
 *
 * The tests do not import this file: they carry their own implementation
 * (framework/oracles/emi.ts), so an error here cannot hide itself.
 */
import type { YearRow } from '../lib/loans';

export interface EmiResult {
  emi: number;
  totalInterest: number;
  totalPayment: number;
  /** One row per loan year (12 payments each). */
  schedule: YearRow[];
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export function monthlyEmi(principal: number, annualRatePct: number, months: number): number {
  if (annualRatePct === 0) return principal / months;
  const r = annualRatePct / 12 / 100;
  const growth = (1 + r) ** months;
  return (principal * r * growth) / (growth - 1);
}

export function calculateEmi(principal: number, annualRatePct: number, years: number): EmiResult {
  const months = years * 12;
  const emi = monthlyEmi(principal, annualRatePct, months);
  const r = annualRatePct / 12 / 100;
  const schedule: YearRow[] = [];
  let balance = principal;

  for (let k = 0; k < months; k += 1) {
    const interest = balance * r;
    const principalPart = k === months - 1 ? balance : emi - interest;
    balance = Math.max(0, balance - principalPart);
    if (k % 12 === 0) schedule.push({ year: k / 12 + 1, principal: 0, interest: 0, closingBalance: 0 });
    const row = schedule[schedule.length - 1];
    row.principal += principalPart;
    row.interest += interest;
    row.closingBalance = balance;
  }

  const totalPayment = emi * months;
  return {
    emi: round2(emi),
    totalInterest: round2(totalPayment - principal),
    totalPayment: round2(totalPayment),
    schedule: schedule.map((row) => ({ ...row, principal: round2(row.principal), interest: round2(row.interest), closingBalance: round2(row.closingBalance) })),
  };
}
