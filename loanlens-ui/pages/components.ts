/**
 * Component objects for the LoanLens charts. Each chart is a figure named by its title;
 * each mark inside it is role="img" with a descriptive name. The exact number behind a mark
 * is read from its data-value attribute after the mark has been found by role.
 */
import { expect } from '@playwright/test';
import type { Locator, Page } from 'playwright';

export type TableRow = Record<string, string>;

/** Body rows of a table as objects keyed by column header. */
export function readTable(table: Locator): Promise<TableRow[]> {
  return table.evaluate((node) => {
    const t = node as HTMLTableElement;
    const headers = [...(t.tHead?.rows[0]?.cells ?? [])].map((c) => c.textContent?.trim() ?? '');
    return [...t.tBodies[0].rows].map((row) => Object.fromEntries([...row.cells].map((cell, i) => [headers[i], cell.textContent?.trim() ?? ''])));
  });
}

export interface ChartMark {
  key: string;
  name: string;
  value: number;
  /** Stacked segments of a bar: value and drawn height in CSS pixels, by segment key. */
  segments: Record<string, { value: number; height: number }>;
}

/** A chart: a figure named by its title whose marks (slices or bars) are images. */
export class Chart {
  readonly figure: Locator;
  readonly marks: Locator;

  constructor(scope: Page | Locator, readonly title: string) {
    this.figure = scope.getByRole('figure', { name: title, exact: true });
    this.marks = this.figure.getByRole('img');
  }

  /** The legend table of a donut, which repeats every value and closes on the total. */
  get legend(): Locator {
    return this.figure.getByRole('table', { name: `${this.title} values`, exact: true });
  }

  async readMarks(): Promise<ChartMark[]> {
    await expect(this.figure, `the "${this.title}" chart should be on screen`).toBeVisible();
    await expect(this.marks, `the "${this.title}" chart should draw at least one mark`).not.toHaveCount(0);
    return this.marks.evaluateAll((elements) =>
      elements.map((el) => ({
        key: el.getAttribute('data-key') ?? '',
        name: el.getAttribute('aria-label') ?? '',
        value: Number(el.getAttribute('data-value')),
        segments: Object.fromEntries(
          [...el.querySelectorAll('[data-segment]')].map((s) => [s.getAttribute('data-segment'), { value: Number(s.getAttribute('data-value')), height: s.getBoundingClientRect().height }]),
        ),
      })),
    );
  }
}
