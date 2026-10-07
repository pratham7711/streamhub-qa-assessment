import type { APIRequestContext } from 'playwright';
import { env } from '../../../framework/config/env.js';
import { BaseApiClient } from '../../../framework/api/BaseApiClient.js';

export type Query = Record<string, string | number | boolean | undefined>;

export class LoanLensApiClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request, env.app.apiUrl);
  }

  health() {
    return this.get('/health');
  }

  listLoans(query?: Query) {
    return this.get('/loans', query);
  }

  getLoan(id: string) {
    return this.get(`/loans/${encodeURIComponent(id)}`);
  }

  summary(query?: Query) {
    return this.get('/loans/summary', query);
  }

  emi(query?: Query) {
    return this.get('/emi', query);
  }

  /** Raw path + query string, e.g. "/loans?page=1&page=2", for malformed requests. */
  raw(pathAndQuery: string, headers?: Record<string, string>) {
    return this.getRaw(pathAndQuery, headers);
  }

  async send(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', pathname: string) {
    const url = this.url(pathname);
    return this.capture(method, url, () => this.request.fetch(url, { method }));
  }
}
