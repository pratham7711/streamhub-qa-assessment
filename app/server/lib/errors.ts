import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ValidationError } from './query.js';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: `No route for ${req.method} ${req.path}` } });
};

/** Pages and API are read-only; anything but GET or HEAD gets a 405 that names the allowed methods. */
export const getOnly: RequestHandler = (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  res.set('Allow', 'GET, HEAD').status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: `${req.method} is not supported; use GET` } });
};

export const MAX_QUERY_PARAMETERS = 50;

/**
 * Node's query-string parser keeps only the first 1,000 pairs and drops the
 * rest silently, so a bad value after them would never be validated. No real
 * request needs more than a few dozen, so anything over the cap is refused.
 */
export const limitQueryParameters: RequestHandler = (req, _res, next) => {
  const query = req.originalUrl.split('?')[1] ?? '';
  const pairs = query ? query.split('&').length : 0;
  if (pairs > MAX_QUERY_PARAMETERS) {
    return next(new HttpError(400, 'TOO_MANY_PARAMETERS', `At most ${MAX_QUERY_PARAMETERS} query parameters are accepted (got ${pairs})`));
  }
  next();
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ValidationError) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'One or more query parameters are invalid', details: err.details } });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof URIError) {
    res.status(400).json({ error: { code: 'MALFORMED_URL', message: 'The URL is not valid percent-encoding' } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } });
};
