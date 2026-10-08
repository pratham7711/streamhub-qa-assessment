import { Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { CustomWorld } from '../../framework/support/world.js';
import { JsonPlaceholderClient, type ApiResponse } from '../api/JsonPlaceholderClient.js';
import { payload, type PayloadSpec } from '../api/post-payloads.js';

const last = (world: CustomWorld) => world.recall<ApiResponse>('response');

function describe(res: ApiResponse): string {
  return `${res.method} ${res.url} -> ${res.status} ${res.statusText} (${res.durationMs} ms)\n${res.text.slice(0, 600)}`;
}

// Longer than the client's 120 s request timeout, so a slow upload fails as the request timing out, not the step.
When('I create {string}', { timeout: 150_000 }, async function (this: CustomWorld, name: string) {
  const spec = payload(name);
  this.remember('payload', spec);
  const api = new JsonPlaceholderClient(this.request);
  const res = spec.kind === 'json' ? await api.createPost(spec.payload) : await api.createPostRaw(spec.body, spec.contentType);
  this.remember('response', res);
  const body = res.text.length > 400 ? `${res.text.slice(0, 400)}… (${res.text.length.toLocaleString('en-IN')} characters)` : res.text;
  this.attach(`Payload "${name}": ${spec.note}\n${res.method} ${res.url}\n→ ${res.status} ${res.statusText} in ${res.durationMs} ms\n${body}`, 'text/plain');
});

Then('the post should be created with id {int}', function (this: CustomWorld, id: number) {
  const res = last(this);
  expect(res.status, describe(res)).toBe(201);
  expect((res.json as { id?: number }).id, describe(res)).toBe(id);
});

Then('the created post should echo every submitted field', function (this: CustomWorld) {
  const spec = this.recall<PayloadSpec>('payload');
  if (spec.kind !== 'json') throw new Error('The echo check needs a JSON payload');
  const res = last(this);
  expect(res.json, describe(res)).toMatchObject(spec.payload);
});

Then('the API should answer with a 4xx client error, not accept it or fail', function (this: CustomWorld) {
  const res = last(this);
  const outcome = res.status < 300 ? ', accepting the invalid payload' : res.status >= 500 ? ', a server-side failure' : '';
  expect(
    res.status >= 400 && res.status < 500,
    `Expected a 4xx rejection (such as 400, 413 or 422), but the API answered ${res.status} ${res.statusText}${outcome}.\n${describe(res)}`,
  ).toBe(true);
});
