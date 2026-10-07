/**
 * Reusable component objects for emicalculator.net widgets.
 *
 * The site predates ARIA: its jQuery UI sliders have no role or aria-valuenow,
 * and its Highcharts charts have no accessibility module. Where no accessible
 * name exists, these objects anchor on the widget's stable id or on Highcharts'
 * documented class names (highcharts-point, highcharts-tooltip, ...), never on
 * position in the DOM. Every value is read from what the user sees: input
 * boxes, scale labels, data labels and tooltips.
 */
import { expect } from '@playwright/test';
import type { Locator, Page } from 'playwright';
import { parseIndianAmount, readNumber } from '../../utils/emi.js';

/** jQuery UI slider bound to a text box, driven the way a user drives it. */
export class Slider {
  constructor(
    private readonly page: Page,
    private readonly track: Locator,
    private readonly scale: Locator,
    private readonly boundInput: Locator,
    readonly name: string,
  ) {}

  private get handle() {
    return this.track.locator('.ui-slider-handle');
  }

  /** Min and max as printed under the slider (e.g. "0" ... "30L"). */
  async range(): Promise<{ min: number; max: number }> {
    const labels = (await this.scale.allInnerTexts()).flatMap((t) => t.split('\n')).map((t) => t.replace('|', '').trim()).filter(Boolean);
    if (labels.length < 2) throw new Error(`${this.name}: could not read the slider scale (got ${JSON.stringify(labels)})`);
    return { min: parseIndianAmount(labels[0]), max: parseIndianAmount(labels.at(-1)!) };
  }

  async value(): Promise<number> {
    return readNumber(await this.boundInput.inputValue());
  }

  /**
   * Drags the handle to the target's proportional position on the track, then
   * nudges it with the arrow keys (one slider step per press) until the bound
   * text box shows exactly the target.
   */
  async setTo(target: number): Promise<{ from: number; draggedTo: number; keyPresses: number }> {
    const { min, max } = await this.range();
    const from = await this.value();
    if (target < min || target > max) throw new Error(`${this.name}: ${target} is outside the slider's ${min}-${max} range`);
    await this.track.scrollIntoViewIfNeeded();
    const trackBox = await this.track.boundingBox();
    const handleBox = await this.handle.boundingBox();
    if (!trackBox || !handleBox) throw new Error(`${this.name}: slider is not rendered`);

    const x = trackBox.x + (trackBox.width * (target - min)) / (max - min);
    const y = handleBox.y + handleBox.height / 2;
    await this.page.mouse.move(handleBox.x + handleBox.width / 2, y);
    await this.page.mouse.down();
    await this.page.mouse.move(x, y, { steps: 12 });
    await this.page.mouse.up();
    const draggedTo = await this.value();

    let keyPresses = 0;
    await this.handle.focus();
    for (let current = draggedTo; current !== target && keyPresses < 200; keyPresses += 1) {
      await this.handle.press(current < target ? 'ArrowRight' : 'ArrowLeft');
      const next = await this.value();
      if (next === current) break;
      current = next;
    }
    await expect.poll(() => this.value(), { message: `${this.name} slider should settle on ${target}` }).toBe(target);
    return { from, draggedTo, keyPresses };
  }
}

/**
 * Hovers a Highcharts point the way a user would: at a spot where the point is
 * the topmost element. A forced hover on the centre can land on something drawn
 * over it (the Balance spline's markers cross the columns), and the stale
 * tooltip of the previous point would be read instead. Callers then wait for
 * their own evidence that the tooltip has moved to this point.
 */
async function hoverPoint(page: Page, point: Locator): Promise<void> {
  await point.scrollIntoViewIfNeeded();
  const spot = await point.evaluate((el) => {
    const b = el.getBoundingClientRect();
    for (const fx of [0.5, 0.3, 0.7, 0.15, 0.85]) {
      for (const fy of [0.5, 0.25, 0.75, 0.1, 0.9]) {
        const x = b.x + b.width * fx;
        const y = b.y + b.height * fy;
        const hit = document.elementFromPoint(x, y);
        if (hit && (hit === el || el.contains(hit))) return { x, y };
      }
    }
    return null;
  });
  if (!spot) throw new Error('Chart point is fully covered by other elements; nowhere to hover');
  await page.mouse.move(spot.x, spot.y, { steps: 4 });
}

/** Highcharts pie chart. */
export class PieChart {
  readonly svg: Locator;
  readonly slices: Locator;
  readonly dataLabels: Locator;
  readonly legendItems: Locator;
  readonly tooltip: Locator;

  constructor(private readonly page: Page, readonly container: Locator) {
    this.svg = container.locator('svg.highcharts-root');
    this.slices = container.locator('path.highcharts-point');
    this.dataLabels = container.locator('.highcharts-data-label');
    this.legendItems = container.locator('.highcharts-legend-item');
    this.tooltip = container.locator('.highcharts-tooltip');
  }

  /** Hovers each slice and reads its tooltip, e.g. "Total Interest: 25.1%". */
  async sections(): Promise<{ name: string; percent: number; label: string }[]> {
    await this.container.scrollIntoViewIfNeeded();
    const count = await this.slices.count();
    // Data labels are SVG <g> elements, which have no innerText.
    const labels = await this.dataLabels.allTextContents();
    const out: { name: string; percent: number; label: string }[] = [];
    let previous = '';
    for (let i = 0; i < count; i += 1) {
      await hoverPoint(this.page, this.slices.nth(i));
      // The interest slice is drawn "selected", which suppresses the hover class,
      // so a changed tooltip is the signal that it now describes this slice.
      await expect(this.tooltip).toBeVisible();
      if (previous) await expect(this.tooltip).not.toHaveText(previous);
      const text = (await this.tooltip.textContent()) ?? '';
      previous = text;
      const match = /^(.*?):\s*([\d.]+)%/.exec(text.trim());
      if (!match) throw new Error(`Unexpected pie tooltip "${text}"`);
      out.push({ name: match[1].trim(), percent: Number(match[2]), label: labels[i]?.trim() ?? '' });
    }
    return out;
  }
}

export interface BarTooltip {
  year: number;
  values: Record<string, number>;
  raw: string;
}

/** Highcharts stacked column chart with one column per calendar year. */
export class ColumnChart {
  readonly svg: Locator;
  readonly columnSegments: Locator;
  readonly xAxisLabels: Locator;
  readonly tooltip: Locator;

  constructor(private readonly page: Page, readonly container: Locator) {
    this.svg = container.locator('svg.highcharts-root');
    this.columnSegments = container.locator('.highcharts-series-group .highcharts-column-series rect.highcharts-point');
    this.xAxisLabels = container.locator('.highcharts-xaxis-labels text');
    this.tooltip = container.locator('.highcharts-tooltip');
  }

  async years(): Promise<number[]> {
    return (await this.xAxisLabels.allTextContents()).map((t) => Number(t.trim()));
  }

  /** Stacked segments sharing an x position form one bar. */
  async barCount(): Promise<number> {
    const boxes = await this.columnSegments.evaluateAll((rects) =>
      rects.map((r) => {
        const b = r.getBoundingClientRect();
        return { x: Math.round(b.x + b.width / 2), h: b.height };
      }),
    );
    return new Set(boxes.filter((b) => b.h > 0).map((b) => b.x)).size;
  }

  /** Hovers every segment of the bar above the given year label and merges the tooltips. */
  async tooltipFor(year: number): Promise<BarTooltip> {
    await this.container.scrollIntoViewIfNeeded();
    const label = this.xAxisLabels.filter({ hasText: new RegExp(`^${year}$`) });
    const labelBox = await label.boundingBox();
    if (!labelBox) throw new Error(`No bar labelled ${year}`);
    const centre = labelBox.x + labelBox.width / 2;

    const segments = await this.columnSegments.evaluateAll((rects) =>
      rects.map((r, index) => {
        const b = r.getBoundingClientRect();
        return { index, left: b.left, right: b.right, h: b.height };
      }),
    );
    const mine = segments.filter((s) => s.h > 0 && s.left <= centre && centre <= s.right);
    if (!mine.length) throw new Error(`No column segments above the ${year} label`);

    const values: Record<string, number> = {};
    const raws: string[] = [];
    for (const segment of mine) {
      const point = this.columnSegments.nth(segment.index);
      await hoverPoint(this.page, point);
      await expect(point).toHaveClass(/highcharts-point-hover/);
      await expect(this.tooltip).toContainText(`Year : ${year}`);
      const raw = ((await this.tooltip.textContent()) ?? '').replace(/\s+/g, ' ').trim();
      raws.push(raw);
      // "Year : 2028Interest : ₹ 86,646Total Payment : ₹ 2,66,933"
      for (const m of raw.matchAll(/([A-Za-z][A-Za-z ]*?)\s*:\s*₹?\s*([\d,]+(?:\.\d+)?)/g)) {
        values[m[1].trim()] = Number(m[2].replace(/,/g, ''));
      }
    }
    return { year, values, raw: raws.join(' | ') };
  }
}

/** bootstrap-datepicker in month mode, opened from its labelled text box. */
export class MonthPicker {
  private readonly panel: Locator;

  constructor(private readonly page: Page, readonly input: Locator) {
    this.panel = page.locator('.datepicker .datepicker-months');
  }

  /** Picks e.g. "Mar 2027" by paging years with « » and clicking the month. */
  async choose(monthYear: string): Promise<void> {
    const [month, yearText] = monthYear.split(/\s+/);
    const year = Number(yearText);
    await this.input.click();
    await expect(this.panel).toBeVisible();
    const yearSwitch = this.panel.locator('.datepicker-switch');
    for (let i = 0; i < 50; i += 1) {
      const shown = Number((await yearSwitch.textContent())?.trim());
      if (shown === year) break;
      await this.panel.locator(shown < year ? '.next' : '.prev').click();
    }
    await expect(yearSwitch).toHaveText(String(year));
    await this.panel.getByText(month, { exact: true }).click();
    await expect(this.input).toHaveValue(monthYear);
  }
}
