/**
 * Reducing-balance EMI maths used by the API.
 *
 *   EMI = P · r · (1 + r)^n / ((1 + r)^n − 1),   r = annual rate / 12 / 100
 *
 * The tests deliberately do NOT import this file: they carry their own
 * implementation (framework/oracles/emi.ts) so that an error here cannot hide itself.
 */
export interface YearlyBreakdown {
  year: number;
  payments: number;
  principal: number;
  interest: number;
  totalPayment: number;
  closingBalance: number;
}

export interface EmiResult {
  emi: number;
  totalInterest: number;
  totalPayment: number;
  schedule: YearlyBreakdown[];
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export function monthlyEmi(principal: number, annualRatePct: number, months: number): number {
  if (annualRatePct === 0) return principal / months;
  const r = annualRatePct / 12 / 100;
  const growth = (1 + r) ** months;
  return (principal * r * growth) / (growth - 1);
}

/** `startMonth` is 1-12; payments are grouped by calendar year, like emicalculator.net. */
export function calculateEmi(
  principal: number,
  annualRatePct: number,
  months: number,
  startYear: number,
  startMonth: number,
): EmiResult {
  const emi = monthlyEmi(principal, annualRatePct, months);
  const r = annualRatePct / 12 / 100;
  const byYear = new Map<number, YearlyBreakdown>();
  let balance = principal;

  for (let k = 0; k < months; k += 1) {
    const interest = balance * r;
    const principalPart = k === months - 1 ? balance : emi - interest;
    balance = Math.max(0, balance - principalPart);
    const year = startYear + Math.floor((startMonth - 1 + k) / 12);
    const row = byYear.get(year) ?? { year, payments: 0, principal: 0, interest: 0, totalPayment: 0, closingBalance: 0 };
    row.payments += 1;
    row.principal += principalPart;
    row.interest += interest;
    row.totalPayment += principalPart + interest;
    row.closingBalance = balance;
    byYear.set(year, row);
  }

  const totalPayment = emi * months;
  return {
    emi: round2(emi),
    totalInterest: round2(totalPayment - principal),
    totalPayment: round2(totalPayment),
    schedule: [...byYear.values()].map((row) => ({
      ...row,
      principal: round2(row.principal),
      interest: round2(row.interest),
      totalPayment: round2(row.totalPayment),
      closingBalance: round2(row.closingBalance),
    })),
  };
}
