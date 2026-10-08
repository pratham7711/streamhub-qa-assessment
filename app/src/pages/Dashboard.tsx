import { DonutChart } from '../components/DonutChart';
import { KpiStrip, PageHeader, Panel, StatusBadge } from '../components/ui';
import { recentLoans, summarise } from '../data/loanBook';
import { date, groupedNumber, inr, inrShort, rate } from '../lib/format';
import { LOAN_TYPE_LABEL, TYPE_COLOR } from '../lib/loans';
import { useLoans } from '../lib/useLoans';

export function Dashboard() {
  const book = useLoans();

  if (book.status !== 'ready') {
    return (
      <>
        <PageHeader title="Portfolio overview" />
        {book.status === 'error' ? (
          <p className="error-note" role="alert">
            {book.message}
          </p>
        ) : (
          <p role="status">Loading the loan book…</p>
        )}
      </>
    );
  }

  const s = summarise(book.loans);
  return (
    <>
      <PageHeader title="Portfolio overview">{groupedNumber(s.count)} loans across four products.</PageHeader>

      <KpiStrip
        label="Portfolio key figures"
        items={[
          { label: 'Total loans', value: groupedNumber(s.count), note: `${groupedNumber(s.activeCount)} active` },
          { label: 'Principal disbursed', value: inr(s.totalPrincipal), note: 'Across four loan products' },
          { label: 'Weighted avg. rate', value: rate(s.weightedAverageRate), note: 'Weighted by principal' },
          { label: 'Monthly EMI inflow', value: inr(s.monthlyEmiInflow), note: 'Active and overdue loans' },
        ]}
      />

      <Panel>
        <DonutChart
          title="Principal by loan type"
          valueLabel="Principal"
          format={inr}
          centerCaption="Principal"
          centerValue={inrShort(s.totalPrincipal)}
          slices={s.byType.map((t) => ({ key: t.type, label: LOAN_TYPE_LABEL[t.type], value: t.principal, color: TYPE_COLOR[t.type] }))}
        />
      </Panel>

      <Panel className="panel-table">
        <div className="panel-head">
          <h2 id="recent-heading">Recent disbursements</h2>
        </div>
        <div className="table-scroll">
          <table className="data-table" aria-labelledby="recent-heading">
            <thead>
              <tr>
                <th scope="col">Loan</th>
                <th scope="col">Borrower</th>
                <th scope="col">Type</th>
                <th scope="col">City</th>
                <th scope="col" className="num">
                  Amount
                </th>
                <th scope="col">Disbursed</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentLoans(book.loans, 5).map((l) => (
                <tr key={l.id}>
                  <td className="loan-id">{l.id}</td>
                  <td>{l.borrower}</td>
                  <td>{LOAN_TYPE_LABEL[l.type]}</td>
                  <td>{l.city}</td>
                  <td className="num">{inr(l.amount)}</td>
                  <td>{date(l.disbursedOn)}</td>
                  <td>
                    <StatusBadge status={l.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
