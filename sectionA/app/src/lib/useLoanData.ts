import { useEffect, useState } from 'react';
import { queryLoanData } from '../data/loanBook';
import { DataError } from './loans';

export type DataState<T> =
  | { status: 'loading'; data?: undefined; error?: undefined }
  | { status: 'ready'; data: T; error?: undefined }
  | { status: 'error'; data?: undefined; error: DataError };

/**
 * Runs a query against the in-browser loan book (see data/loanBook.ts) and re-runs it
 * when the query changes; a superseded result is dropped. The result is keyed by query,
 * so a new query reads as loading from its first render instead of briefly showing the
 * previous one's data. A null query skips the work and keeps the previous result.
 */
export function useLoanData<T>(query: string | null): DataState<T> {
  const [entry, setEntry] = useState<{ query: string | null; state: DataState<T> }>({ query: null, state: { status: 'loading' } });

  useEffect(() => {
    if (!query) return;
    let current = true;
    queryLoanData<T>(query)
      .then((data) => current && setEntry({ query, state: { status: 'ready', data } }))
      .catch((error: unknown) => {
        if (!current) return;
        setEntry({
          query,
          state: {
            status: 'error',
            error: error instanceof DataError ? error : new DataError('DATA_UNAVAILABLE', 'The loan data could not be loaded.'),
          },
        });
      });
    return () => {
      current = false;
    };
  }, [query]);

  return query === null || entry.query === query ? entry.state : { status: 'loading' };
}
