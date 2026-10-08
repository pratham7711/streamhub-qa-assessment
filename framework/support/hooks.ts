import { After, AfterAll, Before, setDefaultTimeout, Status } from '@cucumber/cucumber';
import { chromium, request, type Browser } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';
import { setLoanBookFile } from '../oracles/loan-book.js';
import { CustomWorld, slug } from './world.js';

setDefaultTimeout(env.timeouts.stepMs);

let browser: Browser | undefined;

Before(function (this: CustomWorld, { pickle }) {
  this.scenarioName = pickle.name;
});

// The oracle reads the same mock data file the web app serves.
Before({ tags: '@web-app' }, function () {
  setLoanBookFile('app/public/data/loans.json');
});

Before({ tags: '@ui' }, async function (this: CustomWorld) {
  browser ??= await chromium.launch({ headless: env.headless });
  this.context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-IN', timezoneId: 'Asia/Kolkata' });
  this.context.setDefaultTimeout(env.timeouts.defaultMs);
  await this.context.tracing.start({ screenshots: true, snapshots: true });
  this.page = await this.context.newPage();
  this.page.on('pageerror', (error) => this.pageErrors.push(error.message));
});

Before({ tags: '@api' }, async function (this: CustomWorld) {
  this.request = await request.newContext({ extraHTTPHeaders: { Accept: 'application/json' }, timeout: env.timeouts.defaultMs });
});

// A page error can leave a blank screen that a scenario checking something else would not notice.
After({ tags: '@ui' }, function (this: CustomWorld) {
  if (this.pageErrors.length) throw new Error(`The page threw ${this.pageErrors.length} uncaught error(s):\n${this.pageErrors.join('\n')}`);
});

// A failed UI scenario leaves a screenshot and a Playwright trace (npx playwright show-trace <file>).
After(async function (this: CustomWorld, { result, pickle }) {
  const failed = result?.status === Status.FAILED;
  if (this.context) {
    if (failed) {
      await this.captureEvidence('failure').catch(() => undefined);
      const file = path.join(env.reportDir, 'traces', `${slug(pickle.name)}.zip`);
      mkdirSync(path.dirname(file), { recursive: true });
      await this.context.tracing.stop({ path: file }).catch(() => undefined);
      this.attach(`Playwright trace: ${path.relative(process.cwd(), file)}`, 'text/plain');
    } else {
      await this.context.tracing.stop().catch(() => undefined);
    }
    await this.context.close();
  }
  await this.request?.dispose();
});

AfterAll(async function () {
  await browser?.close();
});
