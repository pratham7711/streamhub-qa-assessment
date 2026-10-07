import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
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

  const webDist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'dist');
  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
