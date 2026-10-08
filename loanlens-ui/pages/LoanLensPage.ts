import type { Locator, Page } from 'playwright';
import { env } from '../../framework/config/env.js';

/** What every LoanLens screen shares: the primary navigation, the page heading, and opening it by URL. */
export class LoanLensPage {
  readonly heading: Locator;
  readonly primaryNav: Locator;

  constructor(
    protected readonly page: Page,
    readonly path: string,
  ) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.primaryNav = page.getByRole('navigation', { name: 'Primary' });
  }

  /** Waits until the screen's data has rendered; each screen says what that means. */
  async waitUntilLoaded(): Promise<void> {}

  async open(): Promise<void> {
    await this.page.goto(`${env.webBaseUrl}${this.path}`);
    await this.waitUntilLoaded();
  }

  navLink(name: string): Locator {
    return this.primaryNav.getByRole('link', { name, exact: true });
  }
}
