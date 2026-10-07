import { Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { CustomWorld } from '../../framework/support/world.js';
import { EmiCalculatorPage, type EmiScheme, type InputBox, type RawInputs, type TenureUnit } from '../pages/EmiCalculatorPage.js';
import {
  expectedEmi,
  expectedEmiInAdvance,
  formatIndian,
  principalForEmi,
  readNumber,
  strictAmount,
  strictRate,
  strictTenure,
  type LoanInput,
} from '../../framework/oracles/emi.js';

interface Snapshot {
  inputs: RawInputs;
  results: string[];
  messages: number;
}

interface Entry {
  box: InputBox;
  text: string;
  key: 'Tab' | 'Enter';
  before: Snapshot;
  after: Snapshot;
}

function calculator(world: CustomWorld): EmiCalculatorPage {
  return (world.scenario.emiPage as EmiCalculatorPage | undefined) ?? world.remember('emiPage', new EmiCalculatorPage(world.page));
}

function unitOf(world: CustomWorld): TenureUnit {
  return (world.scenario.tenureUnit as TenureUnit | undefined) ?? 'years';
}

async function snapshot(page: EmiCalculatorPage): Promise<Snapshot> {
  return { inputs: await page.rawInputs(), results: await page.rawResults(), messages: await page.validationMessages().count() };
}

const BOX_KEY: Record<InputBox, keyof RawInputs> = { 'Loan Amount': 'amount', 'Interest Rate': 'rate', 'Loan Tenure': 'tenure' };
const show = (s: string) => (s === '' ? '(empty)' : `"${s}"`);

/** Reads the three boxes strictly; anything a person would not call a valid entry is reported, not guessed. */
function loanFromBoxes(inputs: RawInputs, unit: TenureUnit): { loan?: LoanInput; problem?: string } {
  const principal = strictAmount(inputs.amount);
  const rate = strictRate(inputs.rate);
  const tenure = strictTenure(inputs.tenure);
  if (principal === null || rate === null || tenure === null) {
    return { problem: `the boxes show amount ${show(inputs.amount)}, rate ${show(inputs.rate)}, tenure ${show(inputs.tenure)}; not all of them are valid numbers` };
  }
  return { loan: { principal, annualRatePct: rate, months: unit === 'years' ? Math.round(tenure * 12) : tenure } };
}

When('I switch the tenure to {word} using the Yr and Mo buttons', async function (this: CustomWorld, unit: TenureUnit) {
  const page = calculator(this);
  this.remember('emiBeforeSwitch', (await page.results()).emi);
  await page.chooseTenureUnit(unit);
  this.remember('tenureUnit', unit);
});

When('I type {string} into the {string} box and press {word}', async function (this: CustomWorld, text: string, box: InputBox, key: 'Tab' | 'Enter') {
  const page = calculator(this);
  const before = await snapshot(page);
  await page.typeText(box, text, key);
  const after = await snapshot(page);
  this.remember<Entry>('entry', { box, text, key, before, after });
  this.attach(
    `Typed ${show(text)} into ${box}, pressed ${key}\n` +
      `Boxes before: ${JSON.stringify(before.inputs)}\nBoxes after:  ${JSON.stringify(after.inputs)}\n` +
      `Results before: ${before.results.join(' | ')}\nResults after:  ${after.results.join(' | ')}`,
    'text/plain',
  );
});

Then('the calculator should refuse the entry instead of calculating with something else', async function (this: CustomWorld) {
  const { box, text, key, before, after } = this.recall<Entry>('entry');
  const raisedMessage = after.messages > before.messages;
  const untouched = JSON.stringify(after.inputs) === JSON.stringify(before.inputs) && after.results.join() === before.results.join();
  await this.captureEvidence(`entry ${text || 'empty'}`);
  if (raisedMessage || untouched) return;

  const shown = after.inputs[BOX_KEY[box]];
  const lines = [
    `I typed ${show(text)} into the ${box} box and pressed ${key}. The calculator did not refuse it and showed no message.`,
    `The box now shows ${show(shown)} (it showed ${show(before.inputs[BOX_KEY[box]])} before).`,
    `The EMI changed from ${before.results[0]} to ${after.results[0]}.`,
  ];
  const rate = strictRate(after.inputs.rate);
  const tenure = strictTenure(after.inputs.tenure);
  if (box === 'Loan Amount' && rate !== null && tenure !== null) {
    const months = unitOf(this) === 'years' ? Math.round(tenure * 12) : tenure;
    const used = principalForEmi(readNumber(after.results[0]), rate, months);
    lines.push(`That EMI belongs to a loan of about ₹${formatIndian(used)} at ${rate}% for ${months} months, so that is the amount it calculated with.`);
  }
  expect(raisedMessage || untouched, lines.join('\n')).toBe(true);
});

Then('no figure on the calculator should read NaN, Infinity or a negative number', async function (this: CustomWorld) {
  const { after } = this.recall<Entry>('entry');
  const figures = { ...after.inputs, emi: after.results[0], totalInterest: after.results[1], totalPayment: after.results[2] };
  const broken = Object.entries(figures).filter(([, value]) => /NaN|Infinity|undefined|(^|\s)[-−]\s*\d/.test(value));
  expect(broken, `figures that a calculator should never display: ${JSON.stringify(Object.fromEntries(broken))}`).toEqual([]);
});

Then('the {string} box should show {string}', async function (this: CustomWorld, box: InputBox, expected: string) {
  await expect(calculator(this).box(box)).toHaveValue(expected);
});

Then('the results should match my own calculation for the values the boxes show', async function (this: CustomWorld) {
  const page = calculator(this);
  const { loan, problem } = loanFromBoxes(await page.rawInputs(), unitOf(this));
  expect(problem, 'every box should hold a valid number').toBeUndefined();
  const shown = await page.results();
  const mine = expectedEmi(loan!);
  this.attach(
    `Boxes read as ₹${formatIndian(loan!.principal)} at ${loan!.annualRatePct}% for ${loan!.months} months\n` +
      `EMI: site ₹${formatIndian(shown.emi)} | mine ₹${mine.emi.toFixed(2)}\n` +
      `Total payment: site ₹${formatIndian(shown.totalPayment)} | mine ₹${mine.totalPayment.toFixed(2)}`,
    'text/plain',
  );
  expect(shown.emi, 'the EMI, rounded to the rupee as the site displays it').toBe(Math.round(mine.emi));
  expect(Math.abs(shown.totalPayment - mine.totalPayment), 'total payment within ₹1').toBeLessThanOrEqual(1);
  expect(Math.abs(shown.totalInterest - mine.totalInterest), 'total interest within ₹1').toBeLessThanOrEqual(1);
});

Then('the EMI should not have changed', async function (this: CustomWorld) {
  expect((await calculator(this).results()).emi).toBe(this.recall<number>('emiBeforeSwitch'));
});

When('I choose {string}', async function (this: CustomWorld, scheme: EmiScheme) {
  this.remember('emiInArrears', (await calculator(this).results()).emi);
  await calculator(this).chooseEmiScheme(scheme);
});

Then('the EMI shown should be the EMI in advance from my own calculation', async function (this: CustomWorld) {
  const page = calculator(this);
  const { loan, problem } = loanFromBoxes(await page.rawInputs(), unitOf(this));
  expect(problem).toBeUndefined();
  const shown = await page.results();
  const mine = expectedEmiInAdvance(loan!);
  this.attach(`EMI in arrears ₹${formatIndian(this.recall<number>('emiInArrears'))}; in advance: site ₹${formatIndian(shown.emi)} | mine ₹${mine.toFixed(2)}`, 'text/plain');
  expect(shown.emi).toBe(Math.round(mine));
  expect(shown.emi, 'paying in advance must lower the EMI').toBeLessThan(this.recall<number>('emiInArrears'));
});

Then('the {string} option should not be offered', async function (this: CustomWorld, scheme: EmiScheme) {
  await expect(calculator(this).emiScheme(scheme)).toBeHidden();
});
