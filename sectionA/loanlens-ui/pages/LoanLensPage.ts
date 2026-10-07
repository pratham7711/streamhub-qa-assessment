import { expect } from '@playwright/test';
import type { Locator, Page } from 'playwright';
import { env } from '../../framework/config/env.js';

/** What every LoanLens screen shares: the primary navigation, the page heading and URL handling. */
export abstract class LoanLensPage {
  readonly heading: Locator;
  readonly primaryNav: Locator;
  readonly homeLink: Locator;

  constructor(
    protected readonly page: Page,
    readonly path: string,
  ) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.primaryNav = page.getByRole('navigation', { name: 'Primary' });
    this.homeLink = page.getByRole('link', { name: 'LoanLens home' });
  }

  /** Waits until the screen's data has rendered. */
  abstract waitUntilLoaded(): Promise<void>;

  async open(query = ''): Promise<void> {
    await this.page.goto(`${env.web.baseUrl}${this.path}${query}`);
    await this.waitUntilLoaded();
  }

  navLink(name: string): Locator {
    return this.primaryNav.getByRole('link', { name, exact: true });
  }

  /** Any loading placeholder still on screen (each is a status named "Loading ..."). */
  get loadingPlaceholders(): Locator {
    return this.page.getByRole('status', { name: /^Loading/ });
  }

  async waitForPlaceholdersToClear(): Promise<void> {
    await expect(this.loadingPlaceholders).toHaveCount(0);
  }

  get url(): URL {
    return new URL(this.page.url());
  }
}
