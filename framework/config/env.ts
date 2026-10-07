/**
 * Single source of runtime configuration for the test framework.
 *
 * Values come from config/env/.env.<TEST_ENV> (default: local), optionally
 * overridden by config/env/.env.<TEST_ENV>.local and finally by real process
 * environment variables, so CI can override any value without editing files.
 * No URL is hardcoded anywhere else in the framework.
 */
import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import path from 'node:path';

const testEnv = process.env.TEST_ENV ?? 'local';
const envDir = path.resolve(process.cwd(), 'config', 'env');
const base = path.join(envDir, `.env.${testEnv}`);
if (!existsSync(base)) {
  throw new Error(`Unknown TEST_ENV "${testEnv}": expected ${path.relative(process.cwd(), base)} to exist`);
}
// dotenv never overrides variables that are already set, so the order below
// gives: process env > private override file > committed profile.
loadDotenv({ path: path.join(envDir, `.env.${testEnv}.local`), quiet: true });
loadDotenv({ path: base, quiet: true });

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') throw new Error(`Missing required config value ${name} (TEST_ENV=${testEnv})`);
  return value;
}

const bool = (name: string, fallback: boolean) => {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : /^(1|true|yes|on)$/i.test(value);
};
const int = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && process.env[name] !== '' ? value : fallback;
};
const trailingSlashless = (url: string) => url.replace(/\/+$/, '');

export type BrowserName = 'chromium' | 'firefox' | 'webkit';
export type HealMode = 'off' | 'suggest' | 'heal';

const appPort = int('APP_PORT', 5055);

export const env = {
  name: testEnv,
  app: {
    port: appPort,
    baseUrl: trailingSlashless(process.env.APP_BASE_URL || `http://localhost:${appPort}`),
    apiUrl: trailingSlashless(process.env.APP_API_URL || `http://localhost:${appPort}/api`),
    autoStart: bool('APP_AUTOSTART', true),
  },
  jsonPlaceholderUrl: trailingSlashless(required('JSONPLACEHOLDER_URL')),
  emiCalculatorUrl: required('EMI_CALCULATOR_URL'),
  browser: {
    name: (process.env.BROWSER ?? 'chromium') as BrowserName,
    channel: process.env.BROWSER_CHANNEL || undefined,
    headless: bool('HEADLESS', true),
    slowMo: int('SLOW_MO', 0),
    viewport: { width: int('VIEWPORT_WIDTH', 1440), height: int('VIEWPORT_HEIGHT', 900) },
  },
  timeouts: {
    defaultMs: int('DEFAULT_TIMEOUT_MS', 15_000),
    stepMs: int('STEP_TIMEOUT_MS', 60_000),
  },
  artifacts: {
    trace: (process.env.TRACE ?? 'retain-on-failure') as 'off' | 'on' | 'retain-on-failure',
    screenshots: (process.env.SCREENSHOTS ?? 'on-failure') as 'off' | 'on-failure' | 'always',
    reportDir: path.resolve(process.cwd(), process.env.REPORTS_DIR ?? 'reports', process.env.SUITE ?? 'adhoc'),
  },
  selfHealing: {
    mode: (process.env.SELF_HEAL ?? 'off') as HealMode,
    provider: process.env.HEAL_PROVIDER ?? 'auto',
  },
} as const;
