import { useEffect, useState } from 'react';
import { loadLoans } from '../data/loanBook';
import type { Loan } from './loans';

export type LoansState = { status: 'loading' } | { status: 'ready'; loans: Loan[] } | { status: 'error'; message: string };

export function useLoans(): LoansState {
  const [state, setState] = useState<LoansState>({ status: 'loading' });
  useEffect(() => {
    let current = true;
    loadLoans()
      .then((loans) => current && setState({ status: 'ready', loans }))
      .catch((error: Error) => current && setState({ status: 'error', message: error.message }));
    return () => {
      current = false;
    };
  }, []);
  return state;
}
