/**
 * Component objects shared by the LoanLens screens.
 *
 * Every element is located by role, accessible name, label, text or test id.
 * Charts expose each mark as role="img" with a descriptive name; the raw
 * number behind a mark is read from its data-value attribute after the mark
 * has been found by role, so assertions use the exact figure the chart drew
 * rather than a rounded label.
 */
import { expect } from '@playwright/test';
import type { Locator, Page } from 'playwright';
import { readNumber } from '../../utils/emi.js';

export const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Starts-with matcher for chart marks, whose names read "<label>: <value> ...". */
export const markName = (label: string) => new RegExp(`^${escapeRegExp(label)}:`);

export type TableRow = Record<string, string>;

/** Body rows of a table as objects keyed by the column header text. */
export async function readTable(table: Locator): Promise<TableRow[]> {
  return table.evaluate((node) => {
    const t = node as HTMLTableElement;
    const headers = [...(t.tHead?.rows[0]?.cells ?? [])].map((c) => c.textContent?.trim() ?? '');
    return [...t.tBodies].flatMap((body) =>
      [...body.rows].map((row) => Object.fromEntries([...row.cells].map((cell, i) => [headers[i], cell.textContent?.trim() ?? '']))),
    );
  });
}

/** The footer (totals) row of a table, keyed by column header. */
export async function readTableFooter(table: Locator): Promise<TableRow | undefined> {
  return table.evaluate((node) => {
    const t = node as HTMLTableElement;
    const headers = [...(t.tHead?.rows[0]?.cells ?? [])].map((c) => c.textContent?.trim() ?? '');
    const row = t.tFoot?.rows[0];
    return row ? Object.fromEntries([...row.cells].map((cell, i) => [headers[i], cell.textContent?.trim() ?? ''])) : undefined;
  });
}

/** A strip of key figures: each figure is a group named by its label. */
export class KeyFigures {
  constructor(private readonly scope: Page | Locator) {}

  figure(label: string): Locator {
    return this.scope.getByRole('group', { name: label, exact: true });
  }

  value(label: string): Locator {
    return this.figure(label).getByTestId('kpi-value');
  }

  async number(label: string): Promise<number> {
    return readNumber(await this.value(label).innerText());
  }
}

export interface ChartMark {
  key: string;
  name: string;
  value: number;
  /** Stacked segments by key (bar charts only). */
  segments: Record<string, number>;
  /** Drawn height of each stacked segment, in CSS pixels (bar charts only). */
  segmentHeights: Record<string, number>;
  /** Drawn size in CSS pixels: bar height, or slice bounding-box area. */
  drawn: number;
}

async function readMarks(marks: Locator): Promise<ChartMark[]> {
  return marks.evaluateAll((elements) =>
    elements.map((el) => {
      const segments = [...el.querySelectorAll('[data-segment]')].map((s) => ({
        key: s.getAttribute('data-segment') ?? '',
        value: Number(s.getAttribute('data-value')),
        height: s.getBoundingClientRect().height,
      }));
      const box = el.getBoundingClientRect();
      return {
        key: el.getAttribute('data-key') ?? '',
        name: el.getAttribute('aria-label') ?? '',
        value: Number(el.getAttribute('data-value')),
        segments: Object.fromEntries(segments.map((s) => [s.key, s.value])),
        segmentHeights: Object.fromEntries(segments.map((s) => [s.key, s.height])),
        drawn: segments.length ? segments.reduce((sum, s) => sum + s.height, 0) : box.width * box.height,
      };
    }),
  );
}

/** Donut chart: a figure named by its title, slices as images, and a legend table that closes on the total. */
export class DonutChart {
  readonly figure: Locator;
  readonly slices: Locator;
  readonly legend: Locator;

  constructor(scope: Page | Locator, readonly title: string) {
    this.figure = scope.getByRole('figure', { name: title, exact: true });
    this.slices = this.figure.getByRole('img');
    this.legend = this.figure.getByRole('table', { name: `${title} values`, exact: true });
  }

  slice(label: string): Locator {
    return this.figure.getByRole('img', { name: markName(label) });
  }

  async waitUntilDrawn(): Promise<void> {
    await expect(this.figure, `the "${this.title}" chart should be on screen`).toBeVisible();
    await expect(this.slices.first()).toBeVisible();
  }

  async readSlices(): Promise<ChartMark[]> {
    await this.waitUntilDrawn();
    return readMarks(this.slices);
  }

  legendRows(): Promise<TableRow[]> {
    return readTable(this.legend);
  }

  legendTotal(): Promise<TableRow | undefined> {
    return readTableFooter(this.legend);
  }
}

export interface TooltipContent {
  title: string;
  values: Record<string, string>;
}

/** Vertical bar chart: each bar is a focusable image; hovering or focusing it opens a tooltip. */
export class BarChart {
  readonly figure: Locator;
  readonly bars: Locator;
  readonly tooltip: Locator;

  constructor(scope: Page | Locator, readonly title: string) {
    this.figure = scope.getByRole('figure', { name: title, exact: true });
    this.bars = this.figure.getByRole('img');
    this.tooltip = this.figure.getByRole('tooltip');
  }

  bar(label: string): Locator {
    return this.figure.getByRole('img', { name: markName(label) });
  }

  async waitUntilDrawn(): Promise<void> {
    await expect(this.figure, `the "${this.title}" chart should be on screen`).toBeVisible();
    await expect(this.bars.first()).toBeVisible();
  }

  async readBars(): Promise<ChartMark[]> {
    await this.waitUntilDrawn();
    return readMarks(this.bars);
  }

  async readTooltip(): Promise<TooltipContent> {
    await expect(this.tooltip, `a tooltip should be open on "${this.title}"`).toBeVisible();
    const [text, terms, definitions] = await Promise.all([
      this.tooltip.innerText(),
      this.tooltip.getByRole('term').allInnerTexts(),
      this.tooltip.getByRole('definition').allInnerTexts(),
    ]);
    const values = Object.fromEntries(terms.map((term, i) => [term.trim(), definitions[i]?.trim() ?? '']));
    return { title: text.split('\n')[0].trim(), values };
  }
}
