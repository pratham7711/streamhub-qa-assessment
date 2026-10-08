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
}

export interface Summary {
  count: number;
  activeCount: number;
  totalPrincipal: number;
  weightedAverageRate: number;
  monthlyEmiInflow: number;
  byType: { type: LoanType; principal: number }[];
}

export interface YearRow {
  year: number;
  principal: number;
  interest: number;
  closingBalance: number;
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
