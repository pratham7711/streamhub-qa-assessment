#!/usr/bin/env node
/**
 * Full-page screenshots of every LoanLens screen at desktop (1440) and mobile
 * (390) widths, written to docs/screenshots/. Needs the web app running:
 *   npm run build && npm run start:web
 *   node section-a/app/scripts/screenshots.mjs
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base = (process.env.BASE_URL ?? 'http://localhost:5055').replace(/\/+$/, '');
const out = path.resolve('docs/screenshots');
mkdirSync(out, { recursive: true });

const screens = [
  { name: 'dashboard', path: '/', ready: (page) => page.getByRole('table', { name: 'Recent disbursements' }).getByRole('row').nth(5).waitFor() },
  {
    name: 'calculator',
    path: '/calculator',
    ready: async (page) => {
      await page.getByRole('table', { name: 'Yearly amortisation schedule' }).waitFor();
      await page.locator('[aria-busy="true"]').first().waitFor({ state: 'detached' }).catch(() => undefined);
    },
  },
  { name: 'reports', path: '/reports', ready: (page) => page.getByRole('navigation', { name: 'Pagination' }).waitFor() },
  { name: 'loan-detail', path: '/loans/LN-1001', ready: (page) => page.getByRole('figure', { name: 'Repayment by year' }).getByRole('img').first().waitFor() },
];

const viewports = [
  { suffix: '', width: 1440, height: 900 },
  { suffix: '-mobile', width: 390, height: 844 },
];

const browser = await chromium.launch();
const errors = [];
for (const vp of viewports) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.suffix ? 2 : 1,
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
  });
  for (const screen of screens) {
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(`${screen.name}${vp.suffix}: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`${screen.name}${vp.suffix}: ${m.text()}`));
    await page.goto(base + screen.path);
    await screen.ready(page);
    await page.waitForTimeout(400);
    const file = path.join(out, `${screen.name}${vp.suffix}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(path.relative(process.cwd(), file));
    await page.close();
  }
  await context.close();
}
await browser.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
