import { useEffect } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { Calculator } from './pages/Calculator';
import { NotFound } from './pages/NotFound';

const TITLES: Record<string, string> = {
  '/': 'Portfolio overview',
  '/calculator': 'EMI calculator',
};

function Wordmark() {
  return (
    <Link to="/" className="brand" aria-label="LoanLens home">
      <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
        <rect width="32" height="32" rx="7" fill="var(--accent)" />
        <circle cx="14" cy="14" r="7.5" fill="none" stroke="#fff" strokeWidth="2.6" />
        <path d="M19.5 19.5 25 25" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M10.5 16.5v-3M14 16.5v-5M17.5 16.5v-2" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="brand-name">LoanLens</span>
    </Link>
  );
}

export function App() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = `${TITLES[pathname] ?? 'Not found'} · LoanLens`;
  }, [pathname]);

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <Wordmark />
          <nav aria-label="Primary">
            <ul className="nav">
              <li>
                <NavLink to="/" end>
                  Dashboard
                </NavLink>
              </li>
              <li>
                <NavLink to="/calculator">EMI calculator</NavLink>
              </li>
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/calculator" element={<Calculator />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="footer">
        <p>LoanLens · demonstration build · all borrowers, amounts and dates are synthetic.</p>
        <p>
          EMI = P × r × (1 + r)<sup>n</sup> ÷ ((1 + r)<sup>n</sup> − 1), reducing balance, monthly rests.
        </p>
      </footer>
    </div>
  );
}
