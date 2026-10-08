/**
 * The one place the test framework reads its configuration. Values come from
 * config/env/.env.<TEST_ENV> (default: local); real environment variables override them.
 * No URL is hardcoded anywhere else.
 */
import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import path from 'node:path';

const testEnv = process.env.TEST_ENV ?? 'local';
const file = path.resolve('config', 'env', `.env.${testEnv}`);
if (!existsSync(file)) throw new Error(`Unknown TEST_ENV "${testEnv}": ${path.relative(process.cwd(), file)} does not exist`);
// dotenv never overrides a variable that is already set, so the environment wins over the file.
loadDotenv({ path: file, quiet: true });

function value(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing config value ${name} (TEST_ENV=${testEnv})`);
  return v;
}

export const env = {
  webBaseUrl: value('WEB_BASE_URL').replace(/\/+$/, ''),
  jsonPlaceholderUrl: value('JSONPLACEHOLDER_URL').replace(/\/+$/, ''),
  headless: !/^(0|false|no|off)$/i.test(process.env.HEADLESS ?? ''),
  timeouts: { defaultMs: Number(value('DEFAULT_TIMEOUT_MS')), stepMs: Number(value('STEP_TIMEOUT_MS')) },
  /** Where this suite's evidence goes: <REPORTS_DIR>/<SUITE>/ (set by scripts/run-suite.mjs). */
  reportDir: path.resolve(process.env.REPORTS_DIR ?? 'test-results', process.env.SUITE ?? 'adhoc'),
  /** npm run heal sets SELF_HEAL=heal; otherwise a broken locator only fails with its diagnosis. */
  selfHeal: process.env.SELF_HEAL === 'heal',
} as const;
