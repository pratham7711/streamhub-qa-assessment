/**
 * The test suite's own EMI oracle. It is written independently of the
 * application code (app/server/lib/emi.ts) on purpose: expected values in every
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

export interface CalendarYearRow {
  year: number;
  payments: number;
  principal: number;
  interest: number;
  total: number;
  closingBalance: number;
}

export interface EmiExpectation {
  emi: number;
  totalPayment: number;
  totalInterest: number;
  principalShare: number;
  interestShare: number;
}

export function expectedEmi({ principal, annualRatePct, months }: LoanInput): EmiExpectation {
  const r = annualRatePct / 1200;
  const emi = r === 0 ? principal / months : (principal * r) / (1 - (1 + r) ** -months);
  const totalPayment = emi * months;
  const totalInterest = totalPayment - principal;
  return {
    emi,
    totalPayment,
    totalInterest,
    principalShare: principal / totalPayment,
    interestShare: totalInterest / totalPayment,
  };
}

/**
 * "EMI in advance": the first instalment is paid on disbursal, so every EMI is
 * discounted by one period. EMI_advance = EMI_arrears / (1 + r).
 */
export function expectedEmiInAdvance(loan: LoanInput): number {
  const r = loan.annualRatePct / 1200;
  return expectedEmi(loan).emi / (1 + r);
}

/**
 * The principal that would produce `emi` at this rate and tenure: the EMI formula
 * solved for P. Used to name what a calculator actually computed with.
 */
export function principalForEmi(emi: number, annualRatePct: number, months: number): number {
  const r = annualRatePct / 1200;
  return r === 0 ? emi * months : (emi * (1 - (1 + r) ** -months)) / r;
}

/**
 * Strict readers for what an input box shows. They accept only what a person
 * would call a valid entry: digits with optional Indian or international
 * grouping, at most one decimal point, and an optional ₹ or % mark. A sign,
 * letters, exponent notation or non-ASCII digits make them return null.
 */
export function strictAmount(text: string): number | null {
  const t = text.trim().replace(/^₹\s*/, '');
  if (!/^(\d{1,3}(,\d{2,3})*|\d+)(\.\d{1,2})?$/.test(t)) return null;
  return Number(t.replace(/,/g, ''));
}

export function strictRate(text: string): number | null {
  const t = text.trim().replace(/\s*%$/, '');
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

export function strictTenure(text: string): number | null {
  const t = text.trim();
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

/** Month-by-month amortisation grouped into calendar years (month is 1-12). */
export function calendarYearSchedule(loan: LoanInput, startYear: number, startMonth: number): CalendarYearRow[] {
  const { emi } = expectedEmi(loan);
  const r = loan.annualRatePct / 1200;
  const rows: CalendarYearRow[] = [];
  let balance = loan.principal;
  for (let i = 0; i < loan.months; i += 1) {
    const monthIndex = startMonth - 1 + i;
    const year = startYear + Math.floor(monthIndex / 12);
    const interest = balance * r;
    const principal = i === loan.months - 1 ? balance : emi - interest;
    balance -= principal;
    let row = rows.at(-1);
    if (!row || row.year !== year) {
      row = { year, payments: 0, principal: 0, interest: 0, total: 0, closingBalance: 0 };
      rows.push(row);
    }
    row.payments += 1;
    row.principal += principal;
    row.interest += interest;
    row.total += principal + interest;
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

/** Formats with Indian digit grouping, e.g. 10796711 -> "1,07,96,711". */
export function formatIndian(value: number): string {
  return Math.round(value).toLocaleString('en-IN');
}
