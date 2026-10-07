/**
 * Serves the built LoanLens web app (section-a/app/dist) and nothing else. The app reads its
 * mock data from /data/loans.json, a static file in that build, so there are no API routes.
 *
 *   npm run build && npm run start:web     http://localhost:5055 (WEB_PORT changes it)
 */
import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');

/** Pages are read-only; anything but GET or HEAD gets a 405 that names the allowed methods. */
const getOnly: RequestHandler = (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  res.set('Allow', 'GET, HEAD').status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: `${req.method} is not supported; use GET` } });
};

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof URIError) {
    res.status(400).json({ error: { code: 'MALFORMED_URL', message: 'The URL is not valid percent-encoding' } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } });
};

if (!existsSync(path.join(dist, 'index.html'))) {
  console.error('section-a/app/dist is missing. Run `npm run build` first.');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
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
app.use(express.static(dist));
// Client-side routes (/reports, /loans/LN-1001) all load the same page.
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(dist, 'index.html'));
});
app.use(errorHandler);

const port = Number(process.env.WEB_PORT ?? 5055);
const server = app.listen(port, () => {
  console.log(`LoanLens web app on http://localhost:${port}`);
});
server.on('error', (error) => {
  console.error(`LoanLens web app could not start on port ${port}: ${error.message}`);
  process.exit(1);
});
