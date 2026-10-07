import { expect } from '@playwright/test';
import type { Locator, Page } from 'playwright';
import { env } from '../../framework/config/env.js';
import { readNumber } from '../../framework/oracles/emi.js';
import { ColumnChart, MonthPicker, PieChart, Slider } from './components.js';

export type LoanProduct = 'Home Loan' | 'Personal Loan' | 'Car Loan';
export type InputBox = 'Loan Amount' | 'Interest Rate' | 'Loan Tenure';
export type TenureUnit = 'years' | 'months';
export type EmiScheme = 'EMI in Advance' | 'EMI in Arrears';

/** What the three boxes literally show, before any parsing. */
export interface RawInputs {
  amount: string;
  rate: string;
  tenure: string;
}

/** Third-party hosts that only serve ads and analytics; blocking them keeps the page stable. */
const AD_HOSTS = /googlesyndication|doubleclick|googletagservices|googleadservices|adservice\.google|google-analytics|googletagmanager|fundingchoicesmessages|amazon-adsystem|adnxs|taboola|outbrain/;

export class EmiCalculatorPage {
  readonly productTabs: Locator;
  readonly interestRate: Locator;
  readonly loanTenure: Locator;
  readonly startMonth: Locator;
  readonly emi: Locator;
  readonly totalInterest: Locator;
  readonly totalPayment: Locator;
  readonly pieChart: PieChart;
  readonly barChart: ColumnChart;
  readonly calendar: MonthPicker;
  private product: LoanProduct = 'Home Loan';

  constructor(private readonly page: Page) {
    this.productTabs = page.locator('.loanproduct-nav');
    this.interestRate = page.getByLabel('Interest Rate', { exact: true });
    this.loanTenure = page.getByLabel('Loan Tenure', { exact: true });
    this.startMonth = page.getByLabel('Schedule showing EMI payments starting from');
    // Result panels: each is a block whose heading names the figure.
    this.emi = page.locator('#emiamount');
    this.totalInterest = page.locator('#emitotalinterest');
    this.totalPayment = page.locator('#emitotalamount');
    this.pieChart = new PieChart(page, page.locator('#emipiechart'));
    this.barChart = new ColumnChart(page, page.locator('#emibarchart'));
    this.calendar = new MonthPicker(page, this.startMonth);
  }

  /** The amount box is labelled after the active product, e.g. "Personal Loan Amount". */
  get loanAmount(): Locator {
    return this.page.getByLabel(`${this.product} Amount`, { exact: true });
  }

  get amountSlider() {
    return new Slider(this.page, this.page.locator('#loanamountslider'), this.page.locator('#loanamountsteps'), this.loanAmount, 'Loan amount');
  }

  get interestSlider() {
    return new Slider(this.page, this.page.locator('#loaninterestslider'), this.page.locator('#loanintereststeps'), this.interestRate, 'Interest rate');
  }

  get tenureSlider() {
    return new Slider(this.page, this.page.locator('#loantermslider'), this.page.locator('#loantermsteps'), this.loanTenure, 'Loan tenure');
  }

  async open(): Promise<void> {
    await this.page.route(AD_HOSTS, (route) => route.abort());
    // A consent banner may appear outside India; dismiss it whenever it blocks an action.
    await this.page.addLocatorHandler(this.page.getByRole('button', { name: /^(Do not consent|Consent|Accept all)$/ }), async (button) => {
      await button.click();
    });
    await this.page.goto(env.emiCalculatorUrl, { waitUntil: 'domcontentloaded' });
    await expect(this.emi).toContainText('₹');
    await expect(this.pieChart.svg).toBeVisible();
  }

  async selectProduct(product: LoanProduct): Promise<void> {
    await this.productTabs.getByRole('link', { name: product, exact: true }).click();
    this.product = product;
    await expect(this.loanAmount, `the amount box should be relabelled "${product} Amount"`).toBeVisible();
    await expect(this.productTabs.getByRole('listitem').filter({ hasText: product })).toHaveClass(/active/);
  }

  /** Types a value into a box and leaves it, which is what triggers the site's recalculation. */
  async typeInto(field: Locator, value: number): Promise<void> {
    await field.click();
    await field.fill(String(value));
    await field.press('Tab');
  }

  box(name: InputBox): Locator {
    return name === 'Loan Amount' ? this.loanAmount : name === 'Interest Rate' ? this.interestRate : this.loanTenure;
  }

  /**
   * Types exactly what a user would, then commits it the way the user chose:
   * Tab leaves the box (blur), Enter commits it while the box keeps focus.
   */
  async typeText(box: InputBox, text: string, commitWith: 'Tab' | 'Enter'): Promise<void> {
    const field = this.box(box);
    await field.click();
    await field.fill(text);
    await field.press(commitWith);
    await this.waitForResultsToSettle();
  }

  async rawInputs(): Promise<RawInputs> {
    return {
      amount: await this.loanAmount.inputValue(),
      rate: await this.interestRate.inputValue(),
      tenure: await this.loanTenure.inputValue(),
    };
  }

  /** The three result figures as displayed (the last line of each panel, below its heading), unparsed so "NaN" or a minus sign stays visible. */
  async rawResults(): Promise<string[]> {
    await this.waitForResultsToSettle();
    const figure = async (panel: Locator) => (await panel.innerText()).split('\n').at(-1)!.trim();
    return [await figure(this.emi), await figure(this.totalInterest), await figure(this.totalPayment)];
  }

  /** The Yr / Mo toggle. Its radios are hidden behind button-styled labels, so the label is what a user clicks. */
  tenureUnitToggle(unit: TenureUnit): Locator {
    return this.page.locator('label', { has: this.page.locator(unit === 'months' ? '#loanmonths' : '#loanyears') });
  }

  async chooseTenureUnit(unit: TenureUnit): Promise<void> {
    await this.tenureUnitToggle(unit).click();
    await expect(this.tenureUnitToggle(unit)).toHaveClass(/active/);
    await this.waitForResultsToSettle();
  }

  emiScheme(scheme: EmiScheme): Locator {
    return this.page.getByText(scheme, { exact: true });
  }

  async chooseEmiScheme(scheme: EmiScheme): Promise<void> {
    await this.emiScheme(scheme).click();
    await this.waitForResultsToSettle();
  }

  /** Any validation message the page might raise for a field. The site has none today; this is what a fix would add. */
  validationMessages(): Locator {
    return this.page.getByRole('alert').or(this.page.locator('[aria-invalid="true"]'));
  }

  async waitForResultsToSettle(): Promise<void> {
    let previous = '';
    await expect
      .poll(
        async () => {
          const now = `${await this.emi.innerText()}|${await this.totalPayment.innerText()}`;
          const stable = now === previous;
          previous = now;
          return stable;
        },
        { message: 'EMI results should stop changing', intervals: [300, 300, 500, 500, 1000] },
      )
      .toBe(true);
  }

  async results() {
    await this.waitForResultsToSettle();
    return {
      emi: readNumber(await this.emi.innerText()),
      totalInterest: readNumber(await this.totalInterest.innerText()),
      totalPayment: readNumber((await this.totalPayment.innerText()).split('\n').at(-1)!),
    };
  }

  async inputValues() {
    return {
      amount: readNumber(await this.loanAmount.inputValue()),
      rate: readNumber(await this.interestRate.inputValue()),
      tenure: readNumber(await this.loanTenure.inputValue()),
      startMonth: await this.startMonth.inputValue(),
    };
  }
}
