import { Link, useParams } from 'react-router-dom';
import { BarChart } from '../components/BarChart';
import { ErrorNote, KpiStrip, PageHeader, Panel, Skeleton, StatusBadge } from '../components/ui';
import { LOAN_TYPE_LABEL, type EmiResponse, type Loan } from '../lib/api';
import { date, inr, inrShort, monthYear, rate, tenure } from '../lib/format';
import { useApi } from '../lib/useApi';

export function LoanDetail() {
  const { id = '' } = useParams();
  const loan = useApi<{ data: Loan }>(`/api/loans/${encodeURIComponent(id)}`);
  const l = loan.data?.data;
  const emi = useApi<EmiResponse>(
    l
      ? `/api/emi?${new URLSearchParams({
          principal: String(l.amount),
          rate: String(l.rate),
          tenure: String(l.tenureMonths),
          tenureUnit: 'months',
          startMonth: l.disbursedOn.slice(0, 7),
        })}`
      : null,
  );
  const e = l ? emi.data?.data : undefined;

  if (loan.status === 'error') {
    const missing = loan.error.status === 404 || loan.error.status === 400;
    return (
      <>
        <PageHeader title={missing ? 'Loan not found' : 'Loan could not be loaded'}>
          {loan.error.status === 404
            ? `There is no loan with the ID ${id} in the book.`
            : loan.error.status === 400
              ? `“${id}” is not a valid loan ID. Loan IDs look like LN-1047.`
              : loan.error.message}
        </PageHeader>
        <p>
          <Link to="/reports" className="button button-secondary">
            Search the loan book
          </Link>
        </p>
      </>
    );
  }

  if (!l) return <Skeleton height={320} label="Loading loan" />;

  return (
    <>
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <Link to="/reports">Loan book report</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{l.id}</span>
      </nav>
      <PageHeader title={`${l.id} · ${l.borrower}`} actions={<StatusBadge status={l.status} />}>
        {LOAN_TYPE_LABEL[l.type]} loan in {l.city}, disbursed {date(l.disbursedOn)}.
      </PageHeader>

      <KpiStrip
        label="Loan terms"
        items={[
          { label: 'Principal', value: inr(l.amount) },
          { label: 'Interest rate', value: rate(l.rate), note: 'per annum' },
          { label: 'Tenure', value: tenure(l.tenureMonths), note: `${l.tenureMonths} monthly payments` },
          { label: 'Monthly EMI', value: inr(l.emi) },
        ]}
      />

      {emi.status === 'error' && <ErrorNote title="The repayment plan could not be calculated.">{emi.error.message}</ErrorNote>}
      {e ? (
        <div className="grid-2 grid-wide-left">
          <Panel>
            <BarChart
              title="Repayment by year"
              description={`From ${monthYear(e.inputs.startMonth)}, grouped by calendar year.`}
              format={inr}
              formatAxis={inrShort}
              legend={[
                { key: 'principal', label: 'Principal', color: 'var(--c-principal)' },
                { key: 'interest', label: 'Interest', color: 'var(--c-interest)' },
              ]}
              bars={e.schedule.map((row) => ({
                key: String(row.year),
                label: String(row.year),
                segments: [
                  { key: 'principal', label: 'Principal', value: row.principal, color: 'var(--c-principal)' },
                  { key: 'interest', label: 'Interest', value: row.interest, color: 'var(--c-interest)' },
                ],
                extra: [{ label: 'Balance', value: inr(row.closingBalance) }],
              }))}
            />
          </Panel>
          <Panel>
            <h2>Cost of the loan</h2>
            <dl className="facts">
              <div role="group" aria-labelledby="fact-interest">
                <dt id="fact-interest">Total interest</dt>
                <dd>{inr(e.totalInterest)}</dd>
              </div>
              <div role="group" aria-labelledby="fact-total">
                <dt id="fact-total">Total payment</dt>
                <dd>{inr(e.totalPayment)}</dd>
              </div>
              <div role="group" aria-labelledby="fact-years">
                <dt id="fact-years">Calendar years</dt>
                <dd>
                  {e.schedule[0].year}–{e.schedule.at(-1)?.year}
                </dd>
              </div>
              <div role="group" aria-labelledby="fact-borrower">
                <dt id="fact-borrower">Borrower</dt>
                <dd>{l.borrower}</dd>
              </div>
            </dl>
            <p className="muted small">
              <Link to={`/calculator`}>Open the EMI calculator</Link> to model a different rate or tenure.
            </p>
          </Panel>
        </div>
      ) : (
        emi.status === 'loading' && <Skeleton height={280} label="Loading repayment plan" />
      )}
    </>
  );
}
