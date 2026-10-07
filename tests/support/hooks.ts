import { After, AfterAll, Before, BeforeAll, setDefaultTimeout, Status, type ITestCaseHookParameter } from '@cucumber/cucumber';
import { chromium, firefox, request, webkit, type Browser } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';
import { assertWebBuilt, ensureAppServer, stopAppServer } from './app-server.js';
import { CustomWorld, slug } from './world.js';

setDefaultTimeout(env.timeouts.stepMs);

let browser: Browser | undefined;
const launchers = { chromium, firefox, webkit };

async function getBrowser(): Promise<Browser> {
  browser ??= await launchers[env.browser.name].launch({
    headless: env.browser.headless,
    channel: env.browser.channel,
    slowMo: env.browser.slowMo,
  });
  return browser;
}

BeforeAll(function () {
  mkdirSync(env.artifacts.reportDir, { recursive: true });
});

Before(function (this: CustomWorld, { pickle }: ITestCaseHookParameter) {
  this.scenarioName = pickle.name;
});

Before({ tags: '@app' }, async function () {
  await ensureAppServer();
});

Before({ tags: '@app and @ui' }, function () {
  assertWebBuilt();
});

Before({ tags: '@ui' }, async function (this: CustomWorld) {
  const b = await getBrowser();
  this.context = await b.newContext({
    viewport: env.browser.viewport,
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
  });
  this.context.setDefaultTimeout(env.timeouts.defaultMs);
  if (env.artifacts.trace !== 'off') {
    await this.context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  }
  this.page = await this.context.newPage();
  this.page.on('pageerror', (error) => {
    this.pageErrors.push(error.message);
  });
  this.page.on('dialog', (dialog) => {
    this.dialogs.push(`${dialog.type()}: ${dialog.message()}`);
    void dialog.dismiss();
  });
  await this.page.exposeBinding('reportCspViolation', (_source, violation: string) => {
    this.cspViolations.push(violation);
  });
  await this.page.addInitScript({
    content: "document.addEventListener('securitypolicyviolation', (e) => window.reportCspViolation(e.violatedDirective + ' blocked ' + (e.blockedURI || 'inline code') + ' ' + (e.sample || '')));",
  });
});

// A CSP violation means LoanLens broke under its own policy, or that the policy had to stop
// something injected. An uncaught page error can leave a blank screen that a scenario looking
// elsewhere would not notice. Either way the scenario fails, whatever it was checking.
// Third-party sites (@external) are not held to this.
After({ tags: '@app and @ui' }, function (this: CustomWorld) {
  if (this.cspViolations.length) {
    throw new Error(`The Content-Security-Policy blocked ${this.cspViolations.length} thing(s):\n${this.cspViolations.join('\n')}`);
  }
  if (this.pageErrors.length) {
    throw new Error(`The page threw ${this.pageErrors.length} uncaught error(s):\n${this.pageErrors.join('\n')}`);
  }
});

Before({ tags: '@api' }, async function (this: CustomWorld) {
  this.request = await request.newContext({
    extraHTTPHeaders: { Accept: 'application/json' },
    timeout: env.timeouts.defaultMs,
  });
});

After(async function (this: CustomWorld, { result, pickle }: ITestCaseHookParameter) {
  const failed = result?.status === Status.FAILED;

  if (this.hasPage) {
    const shoot = env.artifacts.screenshots === 'always' || (failed && env.artifacts.screenshots === 'on-failure');
    if (shoot) {
      await this.captureEvidence(failed ? 'failure' : 'final').catch(() => undefined);
      this.attach(`Page URL at end of scenario: ${this.page.url()}`, 'text/plain');
    }
  }

  if (this.context) {
    if (env.artifacts.trace !== 'off') {
      const keep = env.artifacts.trace === 'on' || failed;
      const dir = path.join(env.artifacts.reportDir, 'traces');
      mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `${slug(pickle.name)}.zip`);
      await this.context.tracing.stop(keep ? { path: file } : undefined).catch(() => undefined);
      if (keep) this.attach(`Playwright trace: ${path.relative(process.cwd(), file)} (open with: npx playwright show-trace <file>)`, 'text/plain');
    }
    await this.context.close();
  }

  if (this.hasRequest) await this.request.dispose();
});

AfterAll(async function () {
  await browser?.close();
  browser = undefined;
  await stopAppServer();
});
