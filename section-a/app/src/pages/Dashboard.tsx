import { Link } from 'react-router-dom';
import { BarChart } from '../components/BarChart';
import { DonutChart } from '../components/DonutChart';
import { ErrorNote, KpiStrip, PageHeader, Panel, Skeleton, StatusBadge } from '../components/ui';
import { LOAN_TYPE_LABEL, STATUS_COLOR, STATUS_LABEL, TYPE_COLOR, type LoanList, type Summary } from '../lib/loans';
import { date, groupedNumber, inr, inrShort, rate } from '../lib/format';
import { useLoanData } from '../lib/useLoanData';

export function Dashboard() {
  const summary = useLoanData<Summary>('loans/summary');
  const recent = useLoanData<LoanList>('loans?sort=-disbursedOn&pageSize=5');
  const s = summary.data?.data;
  const active = s?.byStatus.find((x) => x.status === 'active')?.count ?? 0;

  return (
    <>
      <PageHeader
        title="Portfolio overview"
        actions={
          <Link className="button button-secondary" to="/reports">
            Open loan book report
          </Link>
        }
      >
        {s ? `${groupedNumber(s.count)} loans across four products and eight cities.` : 'Loading the loan book…'}
      </PageHeader>

      {summary.status === 'error' && <ErrorNote title="The portfolio summary could not be loaded.">{summary.error.message}</ErrorNote>}

      {s ? (
        <KpiStrip
          label="Portfolio key figures"
          items={[
            { label: 'Total loans', value: groupedNumber(s.count), note: `${groupedNumber(active)} active` },
            { label: 'Principal disbursed', value: inr(s.totalPrincipal), note: 'Across four loan products' },
            { label: 'Weighted avg. rate', value: rate(s.weightedAverageRate), note: 'Weighted by principal' },
            { label: 'Monthly EMI inflow', value: inr(s.monthlyEmiInflow), note: 'Active and overdue loans' },
          ]}
        />
      ) : (
        summary.status === 'loading' && <Skeleton height={96} label="Loading key figures" />
      )}

      <div className="grid-2">
        <Panel>
          {s ? (
            <DonutChart
              title="Principal by loan type"
              valueLabel="Principal"
              format={inr}
              centerCaption="Principal"
              centerValue={inrShort(s.totalPrincipal)}
              slices={s.byType.map((t) => ({ key: t.type, label: LOAN_TYPE_LABEL[t.type], value: t.principal, color: TYPE_COLOR[t.type] }))}
            />
          ) : (
            <Skeleton height={240} label="Loading principal by loan type" />
          )}
        </Panel>
        <Panel>
          {s ? (
            <BarChart
              title="Loans by status"
              description="Number of loans in each repayment status."
              format={(n) => `${groupedNumber(n)} loan${n === 1 ? '' : 's'}`}
              formatAxis={(n) => groupedNumber(n)}
              bars={s.byStatus.map((x) => ({
                key: x.status,
                label: STATUS_LABEL[x.status],
                segments: [{ key: 'count', label: 'Loans', value: x.count, color: STATUS_COLOR[x.status] }],
                extra: [{ label: 'Principal', value: inr(x.principal) }],
              }))}
            />
          ) : (
            <Skeleton height={240} label="Loading loans by status" />
          )}
        </Panel>
      </div>

      <Panel className="panel-table">
        <div className="panel-head">
          <h2 id="recent-heading">Recent disbursements</h2>
          <Link to="/reports?sort=-disbursedOn">View all</Link>
        </div>
        {recent.status === 'error' && <ErrorNote title="Recent loans could not be loaded.">{recent.error.message}</ErrorNote>}
        {recent.data ? (
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
                {recent.data.data.map((l) => (
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
                    <td>{date(l.disbursedOn)}</td>
                    <td>
                      <StatusBadge status={l.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          recent.status === 'loading' && <Skeleton height={220} label="Loading recent disbursements" />
        )}
      </Panel>
    </>
  );
}
