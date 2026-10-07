export type LoanType = 'home' | 'personal' | 'car' | 'education';
export type LoanStatus = 'active' | 'closed' | 'overdue' | 'pending';

export interface Loan {
  id: string;
  borrower: string;
  type: LoanType;
  amount: number;
  rate: number;
  tenureMonths: number;
  disbursedOn: string;
  status: LoanStatus;
  city: string;
  emi: number;
}

export interface LoanList {
  data: Loan[];
  meta: { page: number; pageSize: number; total: number; totalPages: number; sort: string };
}

export interface Summary {
  data: {
    count: number;
    totalPrincipal: number;
    weightedAverageRate: number;
    monthlyEmiInflow: number;
    byType: { type: LoanType; count: number; principal: number }[];
    byStatus: { status: LoanStatus; count: number; principal: number }[];
  };
}

export interface YearRow {
  year: number;
  payments: number;
  principal: number;
  interest: number;
  totalPayment: number;
  closingBalance: number;
}

export interface EmiResponse {
  data: {
    inputs: { principal: number; rate: number; tenureMonths: number; startMonth: string };
    emi: number;
    totalInterest: number;
    totalPayment: number;
    schedule: YearRow[];
  };
}

export interface Meta {
  data: { loanTypes: LoanType[]; statuses: LoanStatus[]; cities: string[] };
}

export interface DataErrorDetail {
  param: string;
  issue: string;
  message: string;
}

/** A query the data source refused: a bad filter or calculator value, or a loan that does not exist. */
export class DataError extends Error {
  constructor(
    public readonly code: 'VALIDATION_ERROR' | 'INVALID_ID' | 'LOAN_NOT_FOUND' | 'NOT_FOUND' | 'DATA_UNAVAILABLE',
    message: string,
    public readonly details: DataErrorDetail[] = [],
  ) {
    super(message);
  }
}

export const LOAN_TYPE_LABEL: Record<LoanType, string> = {
  home: 'Home',
  personal: 'Personal',
  car: 'Car',
  education: 'Education',
};

export const STATUS_LABEL: Record<LoanStatus, string> = {
  active: 'Active',
  closed: 'Closed',
  overdue: 'Overdue',
  pending: 'Pending',
};

export const TYPE_COLOR: Record<LoanType, string> = {
  home: 'var(--c-home)',
  personal: 'var(--c-personal)',
  car: 'var(--c-car)',
  education: 'var(--c-education)',
};

export const STATUS_COLOR: Record<LoanStatus, string> = {
  active: 'var(--c-active)',
  closed: 'var(--c-closed)',
  overdue: 'var(--c-overdue)',
  pending: 'var(--c-pending)',
};
