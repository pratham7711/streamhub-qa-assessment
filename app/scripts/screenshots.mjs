#!/usr/bin/env node
/**
 * Full-page screenshots of both LoanLens screens, written to docs/screenshots/.
 * Needs the web app running:
 *   npm run build && npm start
 *   node app/scripts/screenshots.mjs
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { chromium } from 'playwright';

loadDotenv({ path: path.join('config', 'env', `.env.${process.env.TEST_ENV ?? 'local'}`), quiet: true });
const base = process.env.WEB_BASE_URL?.replace(/\/+$/, '');
if (!base) throw new Error('WEB_BASE_URL is not set (config/env/.env.local)');
const out = path.resolve('docs/screenshots');
mkdirSync(out, { recursive: true });

const screens = [
  { name: 'dashboard', path: '/', ready: (page) => page.getByRole('table', { name: 'Recent disbursements' }).waitFor() },
  { name: 'calculator', path: '/calculator', ready: (page) => page.getByRole('figure', { name: 'Yearly payments' }).waitFor() },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'en-IN', timezoneId: 'Asia/Kolkata' });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
for (const screen of screens) {
  await page.goto(base + screen.path);
  await screen.ready(page);
  const file = path.join(out, `${screen.name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(path.relative(process.cwd(), file));
}
await browser.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
