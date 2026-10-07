import type { APIRequestContext } from 'playwright';
import { env } from '../../../framework/config/env.js';
import { BaseApiClient } from '../../../framework/api/BaseApiClient.js';

export interface PostPayload {
  title?: unknown;
  body?: unknown;
  userId?: unknown;
  [extra: string]: unknown;
}

/** Client for https://jsonplaceholder.typicode.com (base URL from JSONPLACEHOLDER_URL). */
export class JsonPlaceholderClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request, env.jsonPlaceholderUrl);
  }

  createPost(payload: PostPayload) {
    const url = this.url('/posts');
    return this.capture('POST', url, () => this.request.post(url, { data: payload, timeout: 120_000 }), payload);
  }

  /**
   * Sends bytes exactly as given, for malformed JSON, wrong content types and raw
   * encodings. Always a Buffer: given a *string* with a JSON content type,
   * Playwright JSON-encodes it when it does not parse, so "malformed JSON" would
   * silently go out as a valid JSON string literal.
   */
  createPostRaw(body: string | Buffer, contentType: string) {
    const url = this.url('/posts');
    const bytes = typeof body === 'string' ? Buffer.from(body, 'utf8') : body;
    return this.capture(
      'POST',
      url,
      () => this.request.post(url, { data: bytes, headers: { 'Content-Type': contentType }, timeout: 120_000 }),
      typeof body === 'string' ? body.slice(0, 200) : `<${body.length} raw bytes>`,
    );
  }

  getPost(id: number | string) {
    return this.get(`/posts/${id}`);
  }
}
