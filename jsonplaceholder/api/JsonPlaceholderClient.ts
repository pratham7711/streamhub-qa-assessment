import type { APIRequestContext, APIResponse } from 'playwright';
import { env } from '../../framework/config/env.js';

export type PostPayload = {
  title?: unknown;
  body?: unknown;
  userId?: unknown;
};

/** A response read once: status, timing, and the body as text (and JSON when it parses). */
export interface ApiResponse {
  method: string;
  url: string;
  status: number;
  statusText: string;
  durationMs: number;
  json?: unknown;
  text: string;
}

/** Client for JSONPlaceholder; the base URL comes from JSONPLACEHOLDER_URL. */
export class JsonPlaceholderClient {
  constructor(private readonly request: APIRequestContext) {}

  createPost(payload: PostPayload) {
    return this.post({ data: payload });
  }

  /**
   * Sends bytes exactly as given. Always a Buffer: given a string with a JSON content type,
   * Playwright JSON-encodes it, so invalid bytes would go out as a valid JSON string.
   */
  createPostRaw(body: Buffer, contentType: string) {
    return this.post({ data: body, headers: { 'Content-Type': contentType } });
  }

  private async post(options: { data: unknown; headers?: Record<string, string> }): Promise<ApiResponse> {
    const url = `${env.jsonPlaceholderUrl}/posts`;
    const started = performance.now();
    // The 10 MiB payload takes longer than the default timeout to upload.
    const res: APIResponse = await this.request.post(url, { ...options, timeout: 120_000 });
    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = undefined;
    }
    return { method: 'POST', url, status: res.status(), statusText: res.statusText(), durationMs: Math.round(performance.now() - started), json, text };
  }
}
