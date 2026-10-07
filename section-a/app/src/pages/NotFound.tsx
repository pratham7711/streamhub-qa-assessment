import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui';

export function NotFound() {
  return (
    <>
      <PageHeader title="Page not found">This address does not match any LoanLens screen.</PageHeader>
      <p>
        <Link to="/">Go to the portfolio overview</Link>
      </p>
    </>
  );
}
