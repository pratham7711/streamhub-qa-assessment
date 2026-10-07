import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BarChart } from '../components/BarChart';
import { ErrorNote, KpiStrip, PageHeader, Panel, Skeleton, StatusBadge } from '../components/ui';
import { LOAN_TYPE_LABEL, STATUS_COLOR, STATUS_LABEL, type Loan, type LoanList, type Meta, type Summary } from '../lib/loans';
import { date, groupedNumber, inr, inrShort, rate, tenure } from '../lib/format';
import { useLoanData } from '../lib/useLoanData';

const FILTER_KEYS = ['type', 'status', 'city', 'minAmount', 'maxAmount', 'q'] as const;
type FilterKey = (typeof FILTER_KEYS)[number];
type Filters = Record<FilterKey, string>;
const EMPTY: Filters = { type: '', status: '', city: '', minAmount: '', maxAmount: '', q: '' };
const PAGE_SIZE = 10;
const DEFAULT_SORT = '-disbursedOn';

interface Column {
  key: keyof Loan;
  label: string;
  numeric?: boolean;
  sortable?: boolean;
  firstDirection?: 'asc' | 'desc';
}

const COLUMNS: Column[] = [
  { key: 'id', label: 'Loan' },
  { key: 'borrower', label: 'Borrower', sortable: true, firstDirection: 'asc' },
  { key: 'type', label: 'Type' },
  { key: 'city', label: 'City' },
  { key: 'amount', label: 'Amount', numeric: true, sortable: true },
  { key: 'rate', label: 'Rate', numeric: true, sortable: true },
  { key: 'tenureMonths', label: 'Tenure', numeric: true, sortable: true },
  { key: 'emi', label: 'EMI', numeric: true, sortable: true },
  { key: 'disbursedOn', label: 'Disbursed', sortable: true },
  { key: 'status', label: 'Status' },
];

function readFilters(params: URLSearchParams): Filters {
  return Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? ''])) as Filters;
}

export function Reports() {
  const [params, setParams] = useSearchParams();
  const applied = readFilters(params);
  const [draft, setDraft] = useState<Filters>(applied);
  const appliedKey = FILTER_KEYS.map((k) => applied[k]).join('|');

  useEffect(() => {
    setDraft(readFilters(params));
    // Re-sync the form when the applied filters change (links, reset).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedKey]);

  useEffect(() => {
    // Back/forward can land on the filters React last rendered, so the effect
    // above never fires; read the restored URL directly instead.
    const onHistory = () => setDraft(readFilters(new URLSearchParams(window.location.search)));
    window.addEventListener('popstate', onHistory);
    return () => window.removeEventListener('popstate', onHistory);
  }, []);

  const sort = params.get('sort') ?? DEFAULT_SORT;
  const rawPage = params.get('page');
  const pageIsValid = rawPage === null || (/^\d+$/.test(rawPage) && Number(rawPage) >= 1);
  const page = pageIsValid && rawPage !== null ? Number(rawPage) : 1;

  const filterQuery = new URLSearchParams();
  for (const k of FILTER_KEYS) if (applied[k]) filterQuery.set(k, applied[k]);
  const listQuery = new URLSearchParams(filterQuery);
  listQuery.set('sort', sort);
  listQuery.set('page', String(page));
  listQuery.set('pageSize', String(PAGE_SIZE));

  const meta = useLoanData<Meta>('meta');
  const list = useLoanData<LoanList>(`loans?${listQuery}`);
  const summary = useLoanData<Summary>(`loans/summary?${filterQuery}`);

  const update = (next: Record<string, string | undefined>) => {
    const merged = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v) merged.set(k, v);
      else merged.delete(k);
    }
    setParams(merged);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string | undefined> = { page: undefined };
    for (const k of FILTER_KEYS) next[k] = draft[k].trim() || undefined;
    update(next);
  };

  const onReset = () => {
    setDraft(EMPTY);
    setParams(new URLSearchParams());
  };

  const sortBy = (col: Column) => {
    const current = sort.replace(/^-/, '');
    const descending = sort.startsWith('-');
    let next: string;
    if (current === col.key) next = descending ? String(col.key) : `-${String(col.key)}`;
    else next = (col.firstDirection ?? 'desc') === 'desc' ? `-${String(col.key)}` : String(col.key);
    update({ sort: next === DEFAULT_SORT ? undefined : next, page: undefined });
  };

  const ariaSort = (col: Column) => {
    if (!col.sortable) return undefined;
    if (sort.replace(/^-/, '') !== col.key) return 'none' as const;
    return sort.startsWith('-') ? ('descending' as const) : ('ascending' as const);
  };

  const error = list.status === 'error' ? list.error : summary.status === 'error' ? summary.error : undefined;
  const s = summary.data?.data;
  const listData = list.data;
  const total = listData?.meta.total ?? 0;
  const first = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const last = Math.min(total, page * PAGE_SIZE);
  const busy = list.status === 'loading' || summary.status === 'loading';
  const pastEnd = Boolean(listData && total > 0 && page > listData.meta.totalPages);
  const field = (k: FilterKey) => ({
    value: draft[k],
    onChange: (e: { target: { value: string } }) => setDraft((d) => ({ ...d, [k]: e.target.value })),
  });

  return (
    <>
      <PageHeader title="Loan book report">Filter the book by product, status, city, amount or borrower. The URL keeps the filters, so a report can be shared.</PageHeader>

      <Panel className="filters">
        <form aria-label="Report filters" onSubmit={onSubmit} onReset={onReset} noValidate>
          <div className="filter-grid">
            <div className="field">
              <label htmlFor="f-type">Loan type</label>
              <select id="f-type" {...field('type')}>
                <option value="">All types</option>
                {Object.entries(LOAN_TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-status">Status</label>
              <select id="f-status" {...field('status')}>
                <option value="">All statuses</option>
                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-city">City</label>
              <select id="f-city" {...field('city')}>
                <option value="">All cities</option>
                {(meta.data?.data.cities ?? []).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-min">Min amount (₹)</label>
              <input id="f-min" type="number" inputMode="numeric" min={0} step="any" placeholder="0" {...field('minAmount')} />
            </div>
            <div className="field">
              <label htmlFor="f-max">Max amount (₹)</label>
              <input id="f-max" type="number" inputMode="numeric" min={0} step="any" placeholder="No limit" {...field('maxAmount')} />
            </div>
            <div className="field field-wide">
              <label htmlFor="f-q">Borrower or loan ID</label>
              <input id="f-q" type="search" placeholder="e.g. Mehta or LN-1047" {...field('q')} />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="button">
              Apply filters
            </button>
            <button type="reset" className="button button-secondary">
              Reset
            </button>
          </div>
        </form>
      </Panel>

      {error && (
        <ErrorNote title="These filters cannot be applied.">
          {error.details.length ? (
            <ul>
              {error.details.map((d) => (
                <li key={`${d.param}-${d.issue}`}>{d.message}</li>
              ))}
            </ul>
          ) : (
            <p>{error.message}</p>
          )}
        </ErrorNote>
      )}

      {!error && (
        <>
          {s ? (
            <KpiStrip
              label="Report totals"
              busy={busy}
              items={[
                { label: 'Matching loans', value: groupedNumber(s.count) },
                { label: 'Total principal', value: inr(s.totalPrincipal) },
                { label: 'Weighted avg. rate', value: s.count ? rate(s.weightedAverageRate) : '—' },
              ]}
            />
          ) : (
            <Skeleton height={88} label="Loading report totals" />
          )}

          {s && s.count === 0 ? (
            <Panel className="empty-state">
              <h2>No loans match these filters</h2>
              <p>Widen the amount range, choose another status or city, or clear the search to see more of the book.</p>
              <button type="button" className="button button-secondary" onClick={onReset}>
                Clear all filters
              </button>
            </Panel>
          ) : (
            <div className="report-grid">
              <Panel className="panel-table">
                <div className="panel-head">
                  <h2 id="results-heading">Loans</h2>
                  {listData && !pastEnd && (
                    <p className="muted" role="status">
                      Showing {first}–{last} of {groupedNumber(total)} loans
                    </p>
                  )}
                </div>
                {!pageIsValid && (
                  <p className="page-note" role="note">
                    “{rawPage}” is not a page number, so the report starts at page 1.
                  </p>
                )}
                {listData && pastEnd ? (
                  <div className="empty-state" role="status">
                    <h3>There is no page {groupedNumber(page)}</h3>
                    <p>
                      This report has {listData.meta.totalPages} {listData.meta.totalPages === 1 ? 'page' : 'pages'}.
                    </p>
                    <button type="button" className="button button-secondary" onClick={() => update({ page: listData.meta.totalPages > 1 ? String(listData.meta.totalPages) : undefined })}>
                      Go to page {listData.meta.totalPages}
                    </button>
                  </div>
                ) : listData ? (
                  <>
                    <div className="table-scroll">
                      <table className="data-table" aria-labelledby="results-heading" aria-busy={busy}>
                        <thead>
                          <tr>
                            {COLUMNS.map((col) => (
                              <th key={col.key} scope="col" className={col.numeric ? 'num' : undefined} aria-sort={ariaSort(col)}>
                                {col.sortable ? (
                                  <button type="button" className="sort-button" onClick={() => sortBy(col)}>
                                    {col.label}
                                    <svg className="sort-icon" viewBox="0 0 10 12" width="10" height="12" aria-hidden="true">
                                      <path d="M5 1 8.5 5h-7z" className={ariaSort(col) === 'ascending' ? 'on' : ''} />
                                      <path d="M5 11 1.5 7h7z" className={ariaSort(col) === 'descending' ? 'on' : ''} />
                                    </svg>
                                  </button>
                                ) : (
                                  col.label
                                )}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {listData.data.map((l) => (
                            <tr key={l.id}>
                              <td>
                                <Link to={`/loans/${l.id}`} className="loan-id">
                                  {l.id}
                                </Link>
                              </td>
                              <td>{l.borrower}</td>
                              <td>{LOAN_TYPE_LABEL[l.type]}</td>
                              <td>{l.city}</td>
                              <td className="num">{inr(l.amount)}</td>
                              <td className="num">{rate(l.rate)}</td>
                              <td className="num">{tenure(l.tenureMonths)}</td>
                              <td className="num">{inr(l.emi)}</td>
                              <td>{date(l.disbursedOn)}</td>
                              <td>
                                <StatusBadge status={l.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <nav className="pagination" aria-label="Pagination">
                      <button type="button" className="button button-secondary" disabled={page <= 1} onClick={() => update({ page: page - 1 > 1 ? String(page - 1) : undefined })}>
                        Previous page
                      </button>
                      <span className="page-of">
                        Page {Math.min(page, listData.meta.totalPages)} of {listData.meta.totalPages}
                      </span>
                      <button type="button" className="button button-secondary" disabled={page >= listData.meta.totalPages} onClick={() => update({ page: String(page + 1) })}>
                        Next page
                      </button>
                    </nav>
                  </>
                ) : (
                  <Skeleton height={360} label="Loading loans" />
                )}
              </Panel>
              <Panel>
                {s ? (
                  <BarChart
                    title="Principal by status"
                    description="Principal of the filtered loans in each repayment status."
                    format={inr}
                    formatAxis={inrShort}
                    height={240}
                    bars={s.byStatus.map((x) => ({
                      key: x.status,
                      label: STATUS_LABEL[x.status],
                      segments: [{ key: 'principal', label: 'Principal', value: x.principal, color: STATUS_COLOR[x.status] }],
                      extra: [{ label: 'Loans', value: groupedNumber(x.count) }],
                    }))}
                  />
                ) : (
                  <Skeleton height={240} label="Loading principal by status" />
                )}
              </Panel>
            </div>
          )}
        </>
      )}
    </>
  );
}
