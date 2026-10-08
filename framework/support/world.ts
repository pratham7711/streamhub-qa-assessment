import { setWorldConstructor, World, type IWorldOptions } from '@cucumber/cucumber';
import type { APIRequestContext, BrowserContext, Page } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';

/**
 * One World per scenario. It owns the browser page (@ui) or the API request context (@api)
 * and a scratchpad for values that flow between steps. Page objects and API clients are
 * created by the step files from `this.page` / `this.request`.
 */
export class CustomWorld extends World {
  context?: BrowserContext;
  page!: Page;
  request!: APIRequestContext;
  /** Every uncaught error the page threw; any one fails the scenario. */
  readonly pageErrors: string[] = [];
  scenarioName = '';
  private readonly scratch: Record<string, unknown> = {};
  private evidenceCount = 0;

  constructor(options: IWorldOptions) {
    super(options);
  }

  remember<T>(key: string, value: T): T {
    this.scratch[key] = value;
    return value;
  }

  recall<T>(key: string): T {
    if (!(key in this.scratch)) throw new Error(`Nothing stored under "${key}" earlier in this scenario`);
    return this.scratch[key] as T;
  }

  /** A screenshot embedded in the HTML report and also written to <reports>/<suite>/screenshots/. */
  async captureEvidence(label: string): Promise<void> {
    this.evidenceCount += 1;
    const dir = path.join(env.reportDir, 'screenshots');
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${slug(this.scenarioName)}--${String(this.evidenceCount).padStart(2, '0')}-${slug(label)}.png`);
    this.attach(await this.page.screenshot({ path: file }), { mediaType: 'image/png', fileName: path.basename(file) });
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
