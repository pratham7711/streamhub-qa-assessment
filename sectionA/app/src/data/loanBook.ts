/**
 * LoanLens's data source. The app has no backend: the loan book is mock data, a JSON file
 * shipped with the app (public/data/loans.json), fetched once and queried in the browser.
 *
 * Screens ask for data with a query string such as `loans?type=home&sort=-amount&page=2`,
 * `loans/summary?city=Pune`, `loans/LN-1001`, `emi?principal=2500000&rate=10&tenure=10`
 * or `meta`. Every parameter is validated (see query.ts), and a refusal is a DataError
 * carrying one detail per bad parameter, which the screens show next to the right field.
 */
import { DataError, type Loan, type LoanStatus, type LoanType } from '../lib/loans';
import { calculateEmi, monthlyEmi } from './emi';
import { assertOrdered, parseQuery, ValidationError, type Schema } from './query';

export const LOAN_TYPES: readonly LoanType[] = ['home', 'personal', 'car', 'education'];
export const LOAN_STATUSES: readonly LoanStatus[] = ['active', 'closed', 'overdue', 'pending'];
const SORT_FIELDS = ['amount', 'rate', 'tenureMonths', 'disbursedOn', 'borrower', 'emi'] as const;
const LOAN_ID = /^LN-\d{4}$/;
const TENURE_LIMIT_MONTHS = 480;
export const LOAN_BOOK_URL = '/data/loans.json';

interface Book {
  loans: Loan[];
  cities: string[];
}

let book: Promise<Book> | undefined;

function loadBook(): Promise<Book> {
  book ??= fetch(LOAN_BOOK_URL, { headers: { Accept: 'application/json' } })
    .then((res) => {
      if (!res.ok) throw new DataError('DATA_UNAVAILABLE', `The loan book could not be loaded (HTTP ${res.status}).`);
      return res.json() as Promise<Omit<Loan, 'emi'>[]>;
    })
    .then((rows) => {
      const loans = rows.map((loan) => ({ ...loan, emi: Math.round(monthlyEmi(loan.amount, loan.rate, loan.tenureMonths) * 100) / 100 }));
      return { loans, cities: [...new Set(loans.map((l) => l.city))].sort() };
    });
  // A failed load is not cached, so the next screen tries again.
  book.catch(() => {
    book = undefined;
  });
  return book;
}

function filterSchema(cities: readonly string[]): Schema {
  return {
    type: { kind: 'enumList', values: LOAN_TYPES },
    status: { kind: 'enumList', values: LOAN_STATUSES },
    city: { kind: 'enumList', values: cities },
    minAmount: { kind: 'int', min: 0, max: 1_000_000_000 },
    maxAmount: { kind: 'int', min: 0, max: 1_000_000_000 },
    minRate: { kind: 'number', min: 0, max: 50 },
    maxRate: { kind: 'number', min: 0, max: 50 },
    disbursedFrom: { kind: 'date' },
    disbursedTo: { kind: 'date' },
    q: { kind: 'string', minLength: 2, maxLength: 50 },
  };
}

function listSchema(cities: readonly string[]): Schema {
  return {
    ...filterSchema(cities),
    sort: { kind: 'sort', fields: SORT_FIELDS, default: '-disbursedOn' },
    page: { kind: 'int', min: 1, max: 10_000, default: 1 },
    pageSize: { kind: 'int', min: 1, max: 100, default: 10 },
  };
}

function applyFilters(loans: Loan[], params: Record<string, unknown>): Loan[] {
  assertOrdered(params, 'minAmount', 'maxAmount');
  assertOrdered(params, 'minRate', 'maxRate');
  assertOrdered(params, 'disbursedFrom', 'disbursedTo');
  const q = (params.q as string | undefined)?.toLowerCase();
  return loans.filter((loan) => {
    if (params.type && !(params.type as string[]).includes(loan.type)) return false;
    if (params.status && !(params.status as string[]).includes(loan.status)) return false;
    if (params.city && !(params.city as string[]).includes(loan.city)) return false;
    if (params.minAmount !== undefined && loan.amount < (params.minAmount as number)) return false;
    if (params.maxAmount !== undefined && loan.amount > (params.maxAmount as number)) return false;
    if (params.minRate !== undefined && loan.rate < (params.minRate as number)) return false;
    if (params.maxRate !== undefined && loan.rate > (params.maxRate as number)) return false;
    if (params.disbursedFrom && loan.disbursedOn < (params.disbursedFrom as string)) return false;
    if (params.disbursedTo && loan.disbursedOn > (params.disbursedTo as string)) return false;
    if (q && !loan.borrower.toLowerCase().includes(q) && !loan.id.toLowerCase().includes(q)) return false;
    return true;
  });
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

function summarise({ loans, cities }: Book, search: string) {
  const matching = applyFilters(loans, parseQuery(search, filterSchema(cities)));
  const totalPrincipal = sum(matching.map((l) => l.amount));
  const group = <K extends 'type' | 'status'>(key: K, keys: readonly string[]) =>
    keys.map((k) => {
      const members = matching.filter((l) => l[key] === k);
      return { [key]: k, count: members.length, principal: sum(members.map((l) => l.amount)) };
    });
  return {
    data: {
      count: matching.length,
      totalPrincipal,
      weightedAverageRate: totalPrincipal ? round2(sum(matching.map((l) => l.amount * l.rate)) / totalPrincipal) : 0,
      monthlyEmiInflow: round2(sum(matching.filter((l) => l.status === 'active' || l.status === 'overdue').map((l) => l.emi))),
      byType: group('type', LOAN_TYPES),
      byStatus: group('status', LOAN_STATUSES),
    },
  };
}

function list({ loans, cities }: Book, search: string) {
  const params = parseQuery(search, listSchema(cities));
  const matching = applyFilters(loans, params);
  const sort = params.sort as string;
  const field = (sort.startsWith('-') ? sort.slice(1) : sort) as (typeof SORT_FIELDS)[number];
  const direction = sort.startsWith('-') ? -1 : 1;
  const sorted = [...matching].sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return cmp * direction || a.id.localeCompare(b.id);
  });
  const page = params.page as number;
  const pageSize = params.pageSize as number;
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  return {
    data: sorted.slice((page - 1) * pageSize, page * pageSize),
    meta: { page, pageSize, total: sorted.length, totalPages, sort },
  };
}

function findLoan({ loans }: Book, id: string) {
  if (!LOAN_ID.test(id)) throw new DataError('INVALID_ID', `Loan id "${id}" is malformed; expected the form LN-1234`);
  const loan = loans.find((l) => l.id === id);
  if (!loan) throw new DataError('LOAN_NOT_FOUND', `No loan with id ${id}`);
  return { data: loan };
}

function quoteEmi(search: string) {
  const params = parseQuery(search, {
    principal: { kind: 'number', required: true, min: 1_000, max: 100_000_000, decimals: 2 },
    rate: { kind: 'number', required: true, min: 0, max: 50 },
    // Range-checked below in months, so the message names the unit.
    tenure: { kind: 'number', required: true },
    tenureUnit: { kind: 'enum', values: ['years', 'months'], default: 'years' },
    startMonth: { kind: 'month' },
  });

  const tenure = params.tenure as number;
  const months = params.tenureUnit === 'years' ? tenure * 12 : tenure;
  if (!Number.isInteger(months) || months < 1 || months > TENURE_LIMIT_MONTHS) {
    throw new ValidationError([
      {
        param: 'tenure',
        issue: 'out_of_range',
        message: `"tenure" must be a whole number of months between 1 and ${TENURE_LIMIT_MONTHS} (got ${Math.round(months * 100) / 100} months)`,
        received: tenure,
      },
    ]);
  }

  const now = new Date();
  const [startYear, startMonth] = params.startMonth
    ? (params.startMonth as string).split('-').map(Number)
    : [now.getFullYear(), now.getMonth() + 1];

  const principal = params.principal as number;
  const rate = params.rate as number;
  return {
    data: {
      inputs: { principal, rate, tenureMonths: months, startMonth: `${startYear}-${String(startMonth).padStart(2, '0')}` },
      ...calculateEmi(principal, rate, months, startYear, startMonth),
    },
  };
}

async function run(path: string, search: string): Promise<unknown> {
  // The calculator needs no loan data, so it works even if the book cannot be fetched.
  if (path === 'emi') return quoteEmi(search);
  if (path === 'meta') {
    parseQuery(search, {});
    const { cities } = await loadBook();
    return { data: { loanTypes: LOAN_TYPES, statuses: LOAN_STATUSES, cities } };
  }
  if (path === 'loans') return list(await loadBook(), search);
  if (path === 'loans/summary') return summarise(await loadBook(), search);
  if (path.startsWith('loans/')) {
    parseQuery(search, {});
    return findLoan(await loadBook(), decodeURIComponent(path.slice('loans/'.length)));
  }
  throw new DataError('NOT_FOUND', `Unknown query "${path}"`);
}

export async function queryLoanData<T>(query: string): Promise<T> {
  const mark = query.indexOf('?');
  const path = mark === -1 ? query : query.slice(0, mark);
  const search = mark === -1 ? '' : query.slice(mark + 1);
  try {
    return (await run(path, search)) as T;
  } catch (error) {
    if (error instanceof ValidationError) throw new DataError('VALIDATION_ERROR', 'One or more values are invalid', error.details);
    throw error;
  }
}
