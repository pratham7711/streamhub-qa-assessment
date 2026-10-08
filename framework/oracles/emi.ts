/**
 * The test suite's own EMI oracle. It is written independently of the
 * application code (app/src/data/emi.ts) on purpose: expected values in every
 * EMI assertion come from here, so a bug in the app cannot agree with itself.
 *
 *   EMI = P × r × (1 + r)^n / ((1 + r)^n − 1)
 *   P = principal, r = annual rate ÷ 12 ÷ 100, n = tenure in months
 *
 * With r = 0 the formula is 0/0, so EMI = P / n (straight-line repayment).
 */
export interface LoanInput {
  principal: number;
  annualRatePct: number;
  months: number;
}

export interface LoanYearRow {
  year: number;
  principal: number;
  interest: number;
  closingBalance: number;
}

export function expectedEmi({ principal, annualRatePct, months }: LoanInput) {
  const r = annualRatePct / 1200;
  const emi = r === 0 ? principal / months : (principal * r) / (1 - (1 + r) ** -months);
  const totalPayment = emi * months;
  return { emi, totalPayment, totalInterest: totalPayment - principal };
}

/** Month-by-month amortisation, summed per loan year (payments 1-12 are year 1). */
export function loanYearSchedule(loan: LoanInput): LoanYearRow[] {
  const { emi } = expectedEmi(loan);
  const r = loan.annualRatePct / 1200;
  const rows: LoanYearRow[] = [];
  let balance = loan.principal;
  for (let i = 0; i < loan.months; i += 1) {
    const interest = balance * r;
    const principal = i === loan.months - 1 ? balance : emi - interest;
    balance -= principal;
    if (i % 12 === 0) rows.push({ year: rows.length + 1, principal: 0, interest: 0, closingBalance: 0 });
    const row = rows[rows.length - 1];
    row.principal += principal;
    row.interest += interest;
    row.closingBalance = Math.max(0, balance);
  }
  return rows;
}

/** "25L" -> 2,500,000; "1.5Cr" -> 15,000,000; "750000" -> 750,000; "₹ 1,23,456" -> 123,456. */
export function parseIndianAmount(text: string): number {
  const cleaned = text.replace(/[₹,\s]/g, '');
  const match = /^(\d+(?:\.\d+)?)(L|Lakh|Lakhs|Cr|Crore|K)?$/i.exec(cleaned);
  if (!match) throw new Error(`Cannot read "${text}" as an amount`);
  const value = Number(match[1]);
  const unit = (match[2] ?? '').toLowerCase();
  const factor = unit.startsWith('l') ? 1e5 : unit.startsWith('c') ? 1e7 : unit === 'k' ? 1e3 : 1;
  return Math.round(value * factor);
}

/** Pulls the first number out of UI text: "₹1,07,96,711" -> 10796711, "46.3%" -> 46.3. */
export function readNumber(text: string): number {
  const match = /-?\d[\d,]*(\.\d+)?/.exec(text.replace(/\s/g, ''));
  if (!match) throw new Error(`No number in "${text}"`);
  return Number(match[0].replace(/,/g, ''));
}
