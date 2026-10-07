import type { APIRequestContext, APIResponse } from 'playwright';

/** A captured response: everything a step might assert on, read once. */
export interface ApiResponse<T = unknown> {
  method: string;
  url: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  durationMs: number;
  /** Parsed JSON body, or undefined when the body is not JSON. */
  json?: T;
  text: string;
  requestBody?: unknown;
}

/**
 * Thin wrapper over Playwright's APIRequestContext. It always reads the body as
 * text first, so a non-JSON error page (an HTML 500, a stack trace) is captured
 * and reported instead of crashing the step with a JSON parse error.
 */
export abstract class BaseApiClient {
  protected constructor(
    protected readonly request: APIRequestContext,
    protected readonly baseUrl: string,
  ) {}

  protected url(pathname: string, query?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(`${this.baseUrl}${pathname}`);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.append(key, String(value));
    }
    return url.toString();
  }

  protected async capture<T>(
    method: string,
    url: string,
    send: () => Promise<APIResponse>,
    requestBody?: unknown,
  ): Promise<ApiResponse<T>> {
    const started = performance.now();
    const res = await send();
    const text = await res.text();
    let json: T | undefined;
    try {
      json = text ? (JSON.parse(text) as T) : undefined;
    } catch {
      json = undefined;
    }
    return {
      method,
      url,
      status: res.status(),
      statusText: res.statusText(),
      headers: res.headers(),
      durationMs: Math.round(performance.now() - started),
      json,
      text,
      requestBody,
    };
  }

  protected get<T>(pathname: string, query?: Record<string, string | number | boolean | undefined>) {
    const url = this.url(pathname, query);
    return this.capture<T>('GET', url, () => this.request.get(url));
  }

  /** GET with a raw, pre-encoded query string, for malformed/edge-case parameters. */
  protected getRaw<T>(pathAndQuery: string, headers?: Record<string, string>) {
    const url = `${this.baseUrl}${pathAndQuery}`;
    return this.capture<T>('GET', url, () => this.request.get(url, { headers }));
  }
}
