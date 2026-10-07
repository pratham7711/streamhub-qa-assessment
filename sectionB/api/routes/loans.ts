import { Router } from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { monthlyEmi } from '../lib/emi.js';
import { assertOrdered, parseQuery, type Schema } from '../lib/query.js';
import { HttpError } from '../lib/errors.js';

export const LOAN_TYPES = ['home', 'personal', 'car', 'education'] as const;
export const LOAN_STATUSES = ['active', 'closed', 'overdue', 'pending'] as const;
const SORT_FIELDS = ['amount', 'rate', 'tenureMonths', 'disbursedOn', 'borrower', 'emi'] as const;
const LOAN_ID = /^LN-\d{4}$/;

export interface Loan {
  id: string;
  borrower: string;
  type: (typeof LOAN_TYPES)[number];
  amount: number;
  rate: number;
  tenureMonths: number;
  disbursedOn: string;
  status: (typeof LOAN_STATUSES)[number];
  city: string;
}

const dataFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'loans.json');
const LOANS: ReadonlyArray<Loan & { emi: number }> = (JSON.parse(readFileSync(dataFile, 'utf8')) as Loan[]).map(
  (loan) => ({ ...loan, emi: Math.round(monthlyEmi(loan.amount, loan.rate, loan.tenureMonths) * 100) / 100 }),
);
export const CITIES = [...new Set(LOANS.map((l) => l.city))].sort();

const filterSchema: Schema = {
  type: { kind: 'enumList', values: LOAN_TYPES },
  status: { kind: 'enumList', values: LOAN_STATUSES },
  city: { kind: 'enumList', values: CITIES },
  minAmount: { kind: 'int', min: 0, max: 1_000_000_000 },
  maxAmount: { kind: 'int', min: 0, max: 1_000_000_000 },
  minRate: { kind: 'number', min: 0, max: 50 },
  maxRate: { kind: 'number', min: 0, max: 50 },
  disbursedFrom: { kind: 'date' },
  disbursedTo: { kind: 'date' },
  q: { kind: 'string', minLength: 2, maxLength: 50 },
};

const listSchema: Schema = {
  ...filterSchema,
  sort: { kind: 'sort', fields: SORT_FIELDS, default: '-disbursedOn' },
  page: { kind: 'int', min: 1, max: 10_000, default: 1 },
  pageSize: { kind: 'int', min: 1, max: 100, default: 10 },
};

function applyFilters(params: Record<string, unknown>) {
  assertOrdered(params, 'minAmount', 'maxAmount');
  assertOrdered(params, 'minRate', 'maxRate');
  assertOrdered(params, 'disbursedFrom', 'disbursedTo');
  const q = (params.q as string | undefined)?.toLowerCase();
  return LOANS.filter((loan) => {
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

function pickFilters(params: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(params).filter(([key]) => key in filterSchema));
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

export const loansRouter = Router();

loansRouter.get('/summary', (req, res) => {
  const params = parseQuery(req, filterSchema);
  const loans = applyFilters(params);
  const totalPrincipal = sum(loans.map((l) => l.amount));
  const group = (key: 'type' | 'status', keys: readonly string[]) =>
    keys.map((k) => {
      const members = loans.filter((l) => l[key] === k);
      return { [key]: k, count: members.length, principal: sum(members.map((l) => l.amount)) };
    });
  res.json({
    data: {
      count: loans.length,
      totalPrincipal,
      weightedAverageRate: totalPrincipal ? round2(sum(loans.map((l) => l.amount * l.rate)) / totalPrincipal) : 0,
      monthlyEmiInflow: round2(sum(loans.filter((l) => l.status === 'active' || l.status === 'overdue').map((l) => l.emi))),
      byType: group('type', LOAN_TYPES),
      byStatus: group('status', LOAN_STATUSES),
    },
    meta: { filters: pickFilters(params) },
  });
});

loansRouter.get('/:id', (req, res) => {
  parseQuery(req, {});
  const { id } = req.params;
  if (!LOAN_ID.test(id)) {
    throw new HttpError(400, 'INVALID_ID', `Loan id "${id}" is malformed; expected the form LN-1234`);
  }
  const loan = LOANS.find((l) => l.id === id);
  if (!loan) throw new HttpError(404, 'LOAN_NOT_FOUND', `No loan with id ${id}`);
  res.json({ data: loan });
});

loansRouter.get('/', (req, res) => {
  const params = parseQuery(req, listSchema);
  const loans = applyFilters(params);
  const sort = params.sort as string;
  const field = (sort.startsWith('-') ? sort.slice(1) : sort) as (typeof SORT_FIELDS)[number];
  const direction = sort.startsWith('-') ? -1 : 1;
  const sorted = [...loans].sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return cmp * direction || a.id.localeCompare(b.id);
  });
  const page = params.page as number;
  const pageSize = params.pageSize as number;
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  res.json({
    data: sorted.slice((page - 1) * pageSize, page * pageSize),
    meta: { page, pageSize, total: sorted.length, totalPages, sort, filters: pickFilters(params) },
  });
});
