import express from 'express';
import { loansRouter, LOAN_STATUSES, LOAN_TYPES, CITIES } from './routes/loans.js';
import { emiRouter } from './routes/emi.js';
import { errorHandler, getOnly, limitQueryParameters, notFound } from './lib/errors.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('query parser', 'simple');
  app.use((_req, res, next) => {
    res.set({
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    });
    next();
  });
  app.use(getOnly);

  const api = express.Router();
  api.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  api.use(limitQueryParameters);
  api.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  api.get('/meta', (_req, res) => {
    res.json({ data: { loanTypes: LOAN_TYPES, statuses: LOAN_STATUSES, cities: CITIES } });
  });
  api.use('/loans', loansRouter);
  api.use('/emi', emiRouter);
  api.use(notFound);
  app.use('/api', api);
  app.use(notFound);

  app.use(errorHandler);
  return app;
}
