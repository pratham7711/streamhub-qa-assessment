import { Given, Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { CustomWorld } from '../../../framework/support/world.js';
import { EmiCalculatorPage, type LoanProduct } from '../pages/EmiCalculatorPage.js';
import { calendarYearSchedule, expectedEmi, formatIndian, parseIndianAmount, type LoanInput } from '../../../framework/oracles/emi.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function calculator(world: CustomWorld): EmiCalculatorPage {
  return (world.scenario.emiPage as EmiCalculatorPage | undefined) ?? world.remember('emiPage', new EmiCalculatorPage(world.page));
}

function loanOf(world: CustomWorld): LoanInput {
  return world.recall<LoanInput>('loan');
}

/** The site rounds each figure to the rupee for display. */
function expectRupee(label: string, shown: number, mine: number) {
  expect(Math.abs(shown - mine), `${label}: site shows ₹${formatIndian(shown)}, I calculated ₹${mine.toFixed(2)}`).toBeLessThanOrEqual(1);
}

Given('I launch the EMI calculator application', async function (this: CustomWorld) {
  await calculator(this).open();
});

When('I navigate to the {string} tab', async function (this: CustomWorld, product: string) {
  await calculator(this).selectProduct(product as LoanProduct);
});

When(
  'I enter a loan amount of {string}, an interest rate of {float}% and a tenure of {int} years',
  async function (this: CustomWorld, amount: string, rate: number, years: number) {
    const page = calculator(this);
    const principal = parseIndianAmount(amount);
    await page.typeInto(page.loanAmount, principal);
    await page.typeInto(page.interestRate, rate);
    await page.typeInto(page.loanTenure, years);
    await page.waitForResultsToSettle();
    expect(await page.inputValues(), 'the site should hold the values I entered').toMatchObject({ amount: principal, rate, tenure: years });
    this.remember<LoanInput>('loan', { principal, annualRatePct: rate, months: years * 12 });
  },
);

When(
  'I use the sliders to set the loan amount to {string}, the interest rate to {float}% and the tenure to {int} years',
  async function (this: CustomWorld, amount: string, rate: number, years: number) {
    const page = calculator(this);
    const principal = parseIndianAmount(amount);
    const log: string[] = [];
    for (const [slider, target] of [[page.amountSlider, principal], [page.interestSlider, rate], [page.tenureSlider, years]] as const) {
      const { from, draggedTo, keyPresses } = await slider.setTo(target);
      log.push(`${slider.name}: ${from} -> dragged to ${draggedTo}, then ${keyPresses} arrow-key nudge(s) to reach ${target}`);
      expect(from, `${slider.name}: the tab's default must differ from the target, or the slider was never exercised`).not.toBe(target);
    }
    this.attach(log.join('\n'), 'text/plain');
    await page.waitForResultsToSettle();
    expect(await page.inputValues()).toMatchObject({ amount: principal, rate, tenure: years });
    this.remember<LoanInput>('loan', { principal, annualRatePct: rate, months: years * 12 });
  },
);

When('I change the schedule start month to {string} using the calendar widget', async function (this: CustomWorld, monthYear: string) {
  const page = calculator(this);
  const before = await page.startMonth.inputValue();
  await page.calendar.choose(monthYear);
  await page.waitForResultsToSettle();
  this.attach(`Start month changed from "${before}" to "${await page.startMonth.inputValue()}"`, 'text/plain');
  this.remember('startMonth', monthYear);
});

Then('the EMI shown should match my own calculation', async function (this: CustomWorld) {
  const shown = await calculator(this).results();
  const mine = expectedEmi(loanOf(this));
  this.attach(`EMI: site ₹${formatIndian(shown.emi)} | mine ₹${mine.emi.toFixed(2)}`, 'text/plain');
  expectRupee('Monthly EMI', shown.emi, mine.emi);
  expect(shown.emi, 'the site displays the EMI rounded to the nearest rupee').toBe(Math.round(mine.emi));
});

Then('the total interest and total payment shown should match my own calculation', async function (this: CustomWorld) {
  const shown = await calculator(this).results();
  const mine = expectedEmi(loanOf(this));
  this.attach(
    `Total interest: site ₹${formatIndian(shown.totalInterest)} | mine ₹${mine.totalInterest.toFixed(2)}\n` +
      `Total payment: site ₹${formatIndian(shown.totalPayment)} | mine ₹${mine.totalPayment.toFixed(2)}`,
    'text/plain',
  );
  expectRupee('Total interest', shown.totalInterest, mine.totalInterest);
  expectRupee('Total payment', shown.totalPayment, mine.totalPayment);
  expect(shown.totalPayment - shown.totalInterest, 'principal + interest = total payment').toBe(loanOf(this).principal);
  await this.captureEvidence('emi-results');
});

Then('the pie chart should be visible and available', async function (this: CustomWorld) {
  const pie = calculator(this).pieChart;
  await pie.container.scrollIntoViewIfNeeded();
  await expect(pie.svg).toBeVisible();
  await expect(pie.slices).toHaveCount(2);
  for (let i = 0; i < 2; i += 1) {
    const box = await pie.slices.nth(i).boundingBox();
    expect(box && box.width > 0 && box.height > 0, `pie slice ${i + 1} has a drawn area`).toBe(true);
  }
  await expect(pie.legendItems).toHaveText(['Principal Loan Amount', 'Total Interest']);
  await this.captureEvidence('pie-chart', pie.container);
});

Then('both sections of the pie chart should have numerical values greater than zero', async function (this: CustomWorld) {
  const sections = await calculator(this).pieChart.sections();
  this.remember('pieSections', sections);
  this.attach(sections.map((s) => `${s.name}: ${s.percent}% (data label "${s.label}")`).join('\n'), 'text/plain');
  expect(sections).toHaveLength(2);
  for (const section of sections) {
    expect(section.percent, `${section.name} should be greater than zero`).toBeGreaterThan(0);
    expect(section.label, `${section.name} data label matches its tooltip`).toBe(`${section.percent}%`);
  }
  expect(sections.reduce((sum, s) => sum + s.percent, 0), 'the two sections make up the whole pie').toBeCloseTo(100, 1);
});

Then('the pie chart split should match my calculated principal and interest shares', function (this: CustomWorld) {
  const sections = this.recall<{ name: string; percent: number }[]>('pieSections');
  const mine = expectedEmi(loanOf(this));
  const principal = sections.find((s) => s.name === 'Principal Loan Amount')!;
  const interest = sections.find((s) => s.name === 'Total Interest')!;
  expect(principal.percent, 'principal share (1 decimal place)').toBeCloseTo(mine.principalShare * 100, 1);
  expect(interest.percent, 'interest share (1 decimal place)').toBeCloseTo(mine.interestShare * 100, 1);
});

Then('the bar chart should be visible and available', async function (this: CustomWorld) {
  const bars = calculator(this).barChart;
  await bars.container.scrollIntoViewIfNeeded();
  await expect(bars.svg).toBeVisible();
  await expect(bars.columnSegments.first()).toBeVisible();
  await this.captureEvidence('bar-chart', bars.container);
});

Then('the bar chart should have one bar per calendar year of the repayment schedule', async function (this: CustomWorld) {
  const bars = calculator(this).barChart;
  const [month, year] = this.recall<string>('startMonth').split(' ');
  const schedule = calendarYearSchedule(loanOf(this), Number(year), MONTHS.indexOf(month) + 1);
  const count = await bars.barCount();
  const years = await bars.years();
  this.attach(`Bars counted: ${count}\nYears on the axis: ${years.join(', ')}\nYears in my schedule: ${schedule.map((r) => r.year).join(', ')}`, 'text/plain');
  expect(years, 'x-axis years').toEqual(schedule.map((r) => r.year));
  expect(count, 'number of bars').toBe(schedule.length);
  expect(await bars.columnSegments.count(), 'each bar stacks a principal and an interest segment').toBe(2 * schedule.length);
});

Then('the tooltip of every bar should show values that match my own amortisation', async function (this: CustomWorld) {
  const bars = calculator(this).barChart;
  const [month, year] = this.recall<string>('startMonth').split(' ');
  const schedule = calendarYearSchedule(loanOf(this), Number(year), MONTHS.indexOf(month) + 1);
  const lines: string[] = [];
  for (const row of schedule) {
    const tip = await bars.tooltipFor(row.year);
    lines.push(`${row.year}: tooltip "${tip.raw}" | mine principal ₹${row.principal.toFixed(2)}, interest ₹${row.interest.toFixed(2)}, total ₹${row.total.toFixed(2)}`);
    expect(tip.values.Year, `${row.year}: tooltip names its year`).toBe(row.year);
    expectRupee(`${row.year} principal`, tip.values.Principal, row.principal);
    expectRupee(`${row.year} interest`, tip.values.Interest, row.interest);
    expectRupee(`${row.year} total payment`, tip.values['Total Payment'], row.total);
    expect(Math.abs(tip.values.Principal + tip.values.Interest - tip.values['Total Payment']), `${row.year}: principal + interest = total`).toBeLessThanOrEqual(1);
  }
  this.attach(lines.join('\n'), 'text/plain');
  await bars.tooltipFor(schedule[2]?.year ?? schedule[0].year);
  await this.captureEvidence('bar-tooltip', bars.container);
});
