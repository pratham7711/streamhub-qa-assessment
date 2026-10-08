import { useId, useMemo, useState, type CSSProperties } from 'react';
import { BarChart } from '../components/BarChart';
import { PageHeader, Panel } from '../components/ui';
import { calculateEmi } from '../data/emi';
import { inr, inrShort } from '../lib/format';

type Field = 'amount' | 'rate' | 'tenure';

interface FieldRule {
  label: string;
  suffix: string;
  /** Range the value must fall in; the slider covers the common part of it. */
  min: number;
  max: number;
  slider: { min: number; max: number; step: number };
  empty: string;
  example: string;
  range: string;
  wholeNumber?: boolean;
}

const RULES: Record<Field, FieldRule> = {
  amount: {
    label: 'Loan amount',
    suffix: '₹',
    min: 1_000,
    max: 10_00_00_000,
    slider: { min: 1_00_000, max: 2_00_00_000, step: 50_000 },
    empty: 'Enter a loan amount in rupees.',
    example: '2500000',
    range: `Loan amount must be between ${inr(1_000)} and ${inr(10_00_00_000)}.`,
  },
  rate: {
    label: 'Interest rate',
    suffix: '% p.a.',
    min: 0,
    max: 50,
    slider: { min: 0, max: 20, step: 0.05 },
    empty: 'Enter an annual interest rate.',
    example: '8.5',
    range: 'Interest rate must be between 0% and 50%.',
  },
  tenure: {
    label: 'Loan tenure',
    suffix: 'years',
    min: 1,
    max: 40,
    slider: { min: 1, max: 30, step: 1 },
    empty: 'Enter the tenure in years.',
    example: '20',
    range: 'Loan tenure must be a whole number of years between 1 and 40.',
    wholeNumber: true,
  },
};

/** Refuse the entry or calculate with exactly what the box shows; never quietly calculate with something else. */
function validate(rule: FieldRule, text: string, badInput: boolean): string | undefined {
  if (badInput) return `${rule.label} must be a number.`;
  if (text.trim() === '') return rule.empty;
  if (/e/i.test(text)) return `${rule.label} must be written in plain digits, for example ${rule.example}.`;
  const n = Number(text);
  if (!Number.isFinite(n)) return `${rule.label} must be a number.`;
  if (n < rule.min || n > rule.max || (rule.wholeNumber && !Number.isInteger(n))) return rule.range;
  return undefined;
}

interface SliderFieldProps {
  rule: FieldRule;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onBadInput: (bad: boolean) => void;
}

/** A number box and a range slider for one value. Both carry the field's label. */
function SliderField({ rule, value, error, onChange, onBadInput }: SliderFieldProps) {
  const id = useId();
  const { min, max, step } = rule.slider;
  const numeric = Number(value);
  const sliderValue = Number.isFinite(numeric) ? Math.min(Math.max(numeric, min), max) : min;
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <div className="field-row">
        <label id={`${id}-label`} htmlFor={`${id}-input`}>
          {rule.label}
        </label>
        <div className="input-affix">
          <input
            id={`${id}-input`}
            type="number"
            inputMode="decimal"
            step="any"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            // A number box keeps keystrokes like "--5" but reports them as an empty value without firing onChange.
            onInput={(e) => onBadInput(e.currentTarget.validity.badInput)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
          />
          <span className="affix">{rule.suffix}</span>
        </div>
      </div>
      <input
        type="range"
        className="slider"
        min={min}
        max={max}
        step={step}
        value={sliderValue}
        aria-labelledby={`${id}-label`}
        onChange={(e) => onChange(e.target.value)}
        style={{ '--fill': `${((sliderValue - min) / (max - min)) * 100}%` } as CSSProperties}
      />
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function Calculator() {
  const [values, setValues] = useState<Record<Field, string>>({ amount: '2500000', rate: '10', tenure: '10' });
  const [badInput, setBadInput] = useState<Partial<Record<Field, boolean>>>({});

  const errors: Partial<Record<Field, string>> = {};
  for (const field of Object.keys(RULES) as Field[]) {
    const error = validate(RULES[field], values[field], Boolean(badInput[field]));
    if (error) errors[field] = error;
  }
  const errorCount = Object.keys(errors).length;

  const result = useMemo(
    () => (errorCount ? null : calculateEmi(Number(values.amount), Number(values.rate), Number(values.tenure))),
    [errorCount, values],
  );

  const field = (name: Field) => (
    <SliderField
      rule={RULES[name]}
      value={values[name]}
      error={errors[name]}
      onChange={(value) => setValues((prev) => ({ ...prev, [name]: value }))}
      onBadInput={(bad) => setBadInput((prev) => (prev[name] === bad ? prev : { ...prev, [name]: bad }))}
    />
  );

  return (
    <>
      <PageHeader title="EMI calculator">Monthly instalment, total interest and the year-by-year repayment plan for a reducing-balance loan.</PageHeader>

      <div className="calc-grid">
        <Panel className="calc-inputs">
          <form aria-label="Loan details" onSubmit={(e) => e.preventDefault()} noValidate>
            {field('amount')}
            {field('rate')}
            {field('tenure')}
          </form>
        </Panel>

        <section className="calc-results panel" aria-labelledby="results-heading">
          <h2 id="results-heading">Repayment summary</h2>
          {result ? (
            <dl className="results-figures">
              <div className="figure-emi" role="group" aria-labelledby="fig-emi">
                <dt id="fig-emi">Monthly EMI</dt>
                <dd>{inr(result.emi)}</dd>
              </div>
              <div role="group" aria-labelledby="fig-interest">
                <dt id="fig-interest">Total interest</dt>
                <dd>{inr(result.totalInterest)}</dd>
              </div>
              <div role="group" aria-labelledby="fig-total">
                <dt id="fig-total">Total payment</dt>
                <dd>{inr(result.totalPayment)}</dd>
              </div>
            </dl>
          ) : (
            <p className="results-blocked" role="status">
              Fix the highlighted {errorCount === 1 ? 'field' : 'fields'} to see the repayment plan.
            </p>
          )}
        </section>
      </div>

      {result && (
        <Panel>
          <BarChart
            title="Yearly payments"
            description={`${result.schedule.length * 12} monthly payments, grouped by loan year.`}
            format={inr}
            formatAxis={inrShort}
            legend={[
              { key: 'principal', label: 'Principal', color: 'var(--c-principal)' },
              { key: 'interest', label: 'Interest', color: 'var(--c-interest)' },
            ]}
            bars={result.schedule.map((row) => ({
              key: String(row.year),
              label: `Year ${row.year}`,
              segments: [
                { key: 'principal', label: 'Principal', value: row.principal, color: 'var(--c-principal)' },
                { key: 'interest', label: 'Interest', value: row.interest, color: 'var(--c-interest)' },
              ],
            }))}
          />
        </Panel>
      )}
    </>
  );
}
