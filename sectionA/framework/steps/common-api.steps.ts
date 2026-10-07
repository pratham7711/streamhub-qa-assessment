/**
 * Response assertions shared by every API suite (LoanLens and JSONPlaceholder).
 * They read `this.lastResponse`, which each suite's "When" steps set.
 */
import { Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { CustomWorld } from '../support/world.js';
import type { ApiResponse } from '../api/BaseApiClient.js';

export function describe(res: ApiResponse): string {
  return `${res.method} ${res.url} -> ${res.status} ${res.statusText} (${res.durationMs} ms)\n${res.text.slice(0, 600)}`;
}

export function last(world: CustomWorld): ApiResponse {
  if (!world.lastResponse) throw new Error('No API response recorded yet in this scenario');
  return world.lastResponse;
}

/** Reads a dotted path such as "data.byType.0.count" or "meta.total". */
export function at(body: unknown, dotted: string): unknown {
  return dotted.split('.').reduce<unknown>((value, key) => (value as Record<string, unknown> | undefined)?.[key], body);
}

Then('the response status should be {int}', function (this: CustomWorld, status: number) {
  const res = last(this);
  expect(res.status, describe(res)).toBe(status);
});

Then('the response should be JSON', function (this: CustomWorld) {
  const res = last(this);
  expect(res.headers['content-type'] ?? '', describe(res)).toContain('application/json');
  expect(res.json, `Body is not parseable JSON:\n${describe(res)}`).toBeDefined();
});

Then('the error code should be {string}', function (this: CustomWorld, code: string) {
  const res = last(this);
  expect(at(res.json, 'error.code'), describe(res)).toBe(code);
});

Then('the error should report {string} as {string}', function (this: CustomWorld, param: string, issue: string) {
  const res = last(this);
  const details = (at(res.json, 'error.details') as Array<{ param: string; issue: string }> | undefined) ?? [];
  expect(details, describe(res)).toContainEqual(expect.objectContaining({ param, issue }));
});

Then('the error for {string} should say {string}', function (this: CustomWorld, param: string, text: string) {
  const res = last(this);
  const details = (at(res.json, 'error.details') as Array<{ param: string; message: string }> | undefined) ?? [];
  expect(details.filter((d) => d.param === param).map((d) => d.message).join(' | '), describe(res)).toContain(text);
});

Then('the response should arrive within {int} ms', function (this: CustomWorld, budget: number) {
  const res = last(this);
  expect(res.durationMs, describe(res)).toBeLessThanOrEqual(budget);
});

Then('the response header {string} should be {string}', function (this: CustomWorld, header: string, value: string) {
  const res = last(this);
  expect(res.headers[header.toLowerCase()], describe(res)).toBe(value);
});

Then('the response should not carry the header {string}', function (this: CustomWorld, header: string) {
  const res = last(this);
  expect(res.headers[header.toLowerCase()], describe(res)).toBeUndefined();
});
