import { setWorldConstructor, World, type IWorldOptions } from '@cucumber/cucumber';
import type { APIRequestContext, BrowserContext, Page } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';
import type { ApiResponse } from '../api/BaseApiClient.js';

/**
 * One World per scenario. It owns the browser context, the API request context
 * and a scratchpad for values that flow between steps. Page objects and API
 * clients are created on demand by the step files from `this.page` /
 * `this.request`, so a scenario only pays for what it uses.
 */
export class CustomWorld extends World {
  context?: BrowserContext;
  private _page?: Page;
  private _request?: APIRequestContext;

  /** Values shared between steps of one scenario (inputs, expectations, results). */
  readonly scenario: Record<string, unknown> = {};
  /** Every alert/confirm/prompt the page raised; each is dismissed and recorded. */
  readonly dialogs: string[] = [];
  /** Every Content-Security-Policy violation the page reported. */
  readonly cspViolations: string[] = [];
  /** Every uncaught error the page threw. */
  readonly pageErrors: string[] = [];
  /** The most recent API response, for the generic response assertions. */
  lastResponse?: ApiResponse;

  scenarioName = '';
  private evidenceCount = 0;

  constructor(options: IWorldOptions) {
    super(options);
  }

  get page(): Page {
    if (!this._page) throw new Error('No browser page: tag the scenario or feature with @ui');
    return this._page;
  }

  set page(page: Page) {
    this._page = page;
  }

  get hasPage(): boolean {
    return Boolean(this._page);
  }

  get request(): APIRequestContext {
    if (!this._request) throw new Error('No API request context: tag the scenario or feature with @api');
    return this._request;
  }

  set request(request: APIRequestContext) {
    this._request = request;
  }

  get hasRequest(): boolean {
    return Boolean(this._request);
  }

  remember<T>(key: string, value: T): T {
    this.scenario[key] = value;
    return value;
  }

  recall<T>(key: string): T {
    if (!(key in this.scenario)) throw new Error(`Nothing stored under "${key}" earlier in this scenario`);
    return this.scenario[key] as T;
  }

  /**
   * Screenshot that is both embedded in the Cucumber HTML report and written to
   * reports/<suite>/screenshots, so results survive without opening the report.
   */
  async captureEvidence(label: string, target: Page | { screenshot: Page['screenshot'] } = this.page): Promise<string> {
    this.evidenceCount += 1;
    const dir = path.join(env.artifacts.reportDir, 'screenshots');
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${slug(this.scenarioName)}--${String(this.evidenceCount).padStart(2, '0')}-${slug(label)}.png`);
    const png = await target.screenshot({ path: file });
    this.attach(png, { mediaType: 'image/png', fileName: path.basename(file) });
    return file;
  }

  /** Pretty-printed JSON attached to the report (API evidence). */
  attachJson(label: string, value: unknown): void {
    this.attach(`${label}\n${JSON.stringify(value, null, 2)}`, 'text/plain');
  }
}

export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

setWorldConstructor(CustomWorld);
