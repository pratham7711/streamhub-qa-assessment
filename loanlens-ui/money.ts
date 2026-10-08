import { expect } from '@playwright/test';
import type { Locator } from 'playwright';
import { env } from '../framework/config/env.js';
import { readNumber } from '../framework/oracles/emi.js';

/**
 * Screens show whole rupees, so a figure may sit up to ₹0.50 from the exact value, plus
 * ₹0.01 because the app rounds to the paisa first. Anything looser would accept a figure
 * truncated instead of rounded.
 */
const TOLERANCE = 0.51;

export function expectRupees(actual: number, expected: number, label: string) {
  expect(Math.abs(actual - expected), `${label}: shown ₹${actual}, expected ₹${expected.toFixed(2)} (±₹${TOLERANCE})`).toBeLessThanOrEqual(TOLERANCE);
}

/** Retries until the on-screen amount is within tolerance of `expected`. */
export async function expectAmountOnScreen(locator: Locator, expected: number, label: string) {
  await expect(async () => expectRupees(readNumber(await locator.innerText()), expected, label)).toPass({ timeout: env.timeouts.defaultMs });
}
