import { Given, Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { CustomWorld } from '../../framework/support/world.js';
import { JsonPlaceholderClient } from '../api/JsonPlaceholderClient.js';
import { payload } from '../api/post-payloads.js';
import { describe, last } from '../../framework/steps/common-api.steps.js';

const client = (world: CustomWorld) => new JsonPlaceholderClient(world.request);

/** Short evidence line for the report: big bodies are summarised, not dumped. */
function evidence(world: CustomWorld) {
  const res = last(world);
  const body = res.text.length > 400 ? `${res.text.slice(0, 400)}… (${res.text.length.toLocaleString('en-IN')} characters)` : res.text;
  world.attach(`${res.method} ${res.url}\n→ ${res.status} ${res.statusText} in ${res.durationMs} ms\n${body}`, 'text/plain');
}

Given('the JSONPlaceholder posts endpoint is reachable', async function (this: CustomWorld) {
  const res = await client(this).getPost(1);
  expect(res.status, describe(res)).toBe(200);
});

When('I create {string}', async function (this: CustomWorld, name: string) {
  const spec = payload(name);
  this.remember('payload', spec);
  this.attach(`Payload "${name}": ${spec.note}`, 'text/plain');
  const api = client(this);
  this.lastResponse = spec.kind === 'json' ? await api.createPost(spec.payload) : await api.createPostRaw(spec.body, spec.contentType);
  evidence(this);
});

When('I fetch the post with id {int}', async function (this: CustomWorld, id: number) {
  this.lastResponse = await client(this).getPost(id);
  evidence(this);
});

Then('the API should not fail with a server error', function (this: CustomWorld) {
  const res = last(this);
  expect(res.status, `Expected a non-5xx status, got a server-side failure.\n${describe(res)}`).toBeLessThan(500);
});

Then('the response should not leak implementation details', function (this: CustomWorld) {
  const res = last(this);
  const leaks = [/\n\s+at .+\(.+:\d+:\d+\)/, /node_modules/, /\b(SyntaxError|TypeError|ReferenceError|PayloadTooLargeError)\b/].filter((p) => p.test(res.text));
  expect(leaks.map(String), `Response body exposes internals (stack trace, paths or exception names):\n${describe(res)}`).toEqual([]);
});

Then('the API should reject the request with a 4xx client error', function (this: CustomWorld) {
  const res = last(this);
  expect(
    res.status >= 400 && res.status < 500,
    `Expected a 4xx rejection (400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type or 422 Unprocessable Entity), but the API answered ${res.status} ${res.statusText}${res.status < 300 ? ' and accepted the invalid payload' : res.status >= 500 ? ', a server-side failure' : ''}.\n${describe(res)}`,
  ).toBe(true);
});

Then('the response should explain what is wrong', function (this: CustomWorld) {
  const res = last(this);
  const body = res.json as Record<string, unknown> | undefined;
  const message = body?.error ?? body?.message ?? body?.errors;
  expect(message, `Expected an error message field (error / message / errors) in the body.\n${describe(res)}`).toBeTruthy();
});

Then('the post should be created with id {int}', function (this: CustomWorld, id: number) {
  const res = last(this);
  expect(res.status, describe(res)).toBe(201);
  expect((res.json as { id?: number }).id, describe(res)).toBe(id);
});

Then('the created post should echo every submitted field unchanged', function (this: CustomWorld) {
  const spec = this.recall<ReturnType<typeof payload>>('payload');
  if (spec.kind !== 'json') throw new Error('Echo check needs a JSON payload');
  const res = last(this);
  expect(res.json, describe(res)).toMatchObject(spec.payload);
});

Then('the response time should be under {int} seconds', function (this: CustomWorld, seconds: number) {
  const res = last(this);
  expect(res.durationMs, describe(res)).toBeLessThan(seconds * 1000);
});
