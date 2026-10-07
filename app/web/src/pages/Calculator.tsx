import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { BarChart } from '../components/BarChart';
import { DonutChart } from '../components/DonutChart';
import { PageHeader, Panel } from '../components/ui';
import type { ApiErrorDetail, EmiResponse } from '../lib/api';
import { inr, inrShort, inrWords, monthYear } from '../lib/format';
import { useApi } from '../lib/useApi';

type Unit = 'years' | 'months';
type Field = 'amount' | 'rate' | 'tenure' | 'start';

const FIELD_OF_PARAM: Record<string, Field> = { principal: 'amount', rate: 'rate', tenure: 'tenure', tenureUnit: 'tenure', startMonth: 'start' };
const LABEL: Record<Field, string> = { amount: 'Loan amount', rate: 'Interest rate', tenure: 'Loan tenure', start: 'First EMI month' };

function thisMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Turns the API's `"principal" must be between 1000 and 100000000` into field language. */
function friendly(detail: ApiErrorDetail): string {
  const field = FIELD_OF_PARAM[detail.param];
  let message = detail.message.replace(/"[^"]+"/, field ? LABEL[field] : detail.param);
  if (detail.param === 'principal') message = message.replace(/\b\d{4,}\b/g, (n) => inr(Number(n)));
  if (detail.param === 'rate') message = message.replace(/between (\S+) and (\S+)/, 'between $1% and $2%');
  return message.endsWith('.') ? message : `${message}.`;
}

interface SliderFieldProps {
  field: Field;
  value: string;
  onChange: (value: string) => void;
  onBadInput: (bad: boolean) => void;
  min: number;
  max: number;
  sliderStep: number;
  suffix?: ReactNode;
  hint?: string;
  error?: string;
}

function SliderField({ field, value, onChange, onBadInput, min, max, sliderStep, suffix, hint, error }: SliderFieldProps) {
  const id = useId();
  const numeric = Number(value);
  const sliderValue = Number.isFinite(numeric) ? Math.min(Math.max(numeric, min), max) : min;
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <div className="field-row">
        <label id={`${id}-label`} htmlFor={`${id}-input`}>
          {LABEL[field]}
        </label>
        <div className="input-affix">
          <input
            id={`${id}-input`}
            type="number"
            inputMode="decimal"
            step="any"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onInput={(e) => onBadInput(e.currentTarget.validity.badInput)}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
          />
          {suffix && <span className="affix">{suffix}</span>}
        </div>
      </div>
      <input
        type="range"
        className="slider"
        min={min}
        max={max}
        step={sliderStep}
        value={sliderValue}
        aria-labelledby={`${id}-label`}
        onChange={(e) => onChange(e.target.value)}
        style={{ '--fill': `${((sliderValue - min) / (max - min)) * 100}%` } as CSSProperties}
      />
      <div className="slider-scale" aria-hidden="true">
        <span>{field === 'amount' ? inrShort(min) : min}</span>
        <span>{field === 'amount' ? inrShort(max) : max}</span>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function Calculator() {
  const [amount, setAmount] = useState('2500000');
  const [rateValue, setRateValue] = useState('10');
  const [tenure, setTenure] = useState('10');
  const [unit, setUnit] = useState<Unit>('years');
  const [start, setStart] = useState(thisMonth);

  const [badInput, setBadInput] = useState<Partial<Record<Field, boolean>>>({});
  const markBad = (field: Field) => (bad: boolean) => setBadInput((prev) => (prev[field] === bad ? prev : { ...prev, [field]: bad }));

  const localErrors = useMemo(() => {
    const errors: Partial<Record<Field, string>> = {};
    const check = (field: Field, text: string, empty: string, example: string) => {
      if (badInput[field]) errors[field] = `${LABEL[field]} must be a number.`;
      else if (text.trim() === '') errors[field] = empty;
      else if (/e/i.test(text)) errors[field] = `${LABEL[field]} must be written in plain digits, for example ${example}.`;
      else if (!Number.isFinite(Number(text))) errors[field] = `${LABEL[field]} must be a number.`;
    };
    check('amount', amount, 'Enter a loan amount in rupees.', '2500000');
    check('rate', rateValue, 'Enter an annual interest rate.', '8.5');
    check('tenure', tenure, `Enter the tenure in ${unit}.`, unit === 'years' ? '20' : '240');
    if (!/^\d{4}-\d{2}$/.test(start)) errors.start = 'Choose the month of the first EMI.';
    return errors;
  }, [amount, rateValue, tenure, unit, start, badInput]);

  const url = Object.keys(localErrors).length
    ? null
    : `/api/emi?${new URLSearchParams({ principal: amount, rate: rateValue, tenure, tenureUnit: unit, startMonth: start })}`;

  const [debounced, setDebounced] = useState(url);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(url), 250);
    return () => clearTimeout(timer);
  }, [url]);

  const result = useApi<EmiResponse>(debounced);
  const lastGood = useRef<EmiResponse['data'] | null>(null);
  if (result.status === 'ready' && debounced) lastGood.current = result.data.data;

  const apiErrors: Partial<Record<Field, string>> = {};
  if (result.status === 'error' && debounced === url) {
    for (const d of result.error.details) {
      const field = FIELD_OF_PARAM[d.param];
      if (field) apiErrors[field] ??= friendly(d);
    }
  }
  const errors = { ...apiErrors, ...localErrors };
  const hasErrors = Object.keys(errors).length > 0;
  const pending = !hasErrors && (url !== debounced || result.status === 'loading');
  const data = hasErrors ? null : lastGood.current;

  const switchUnit = (next: Unit) => {
    if (next === unit) return;
    const value = Number(tenure);
    if (Number.isFinite(value) && tenure.trim() !== '') {
      setTenure(String(next === 'months' ? Math.round(value * 12) : Math.round((value / 12) * 100) / 100));
    }
    setUnit(next);
  };

  return (
    <>
      <PageHeader title="EMI calculator">
        Monthly instalment, total interest and the year-by-year repayment plan for a reducing-balance loan.
      </PageHeader>

      <div className="calc-grid">
        <Panel className="calc-inputs">
          <form aria-label="Loan details" onSubmit={(e) => e.preventDefault()} noValidate>
            <SliderField
              field="amount"
              value={amount}
              onChange={setAmount}
              onBadInput={markBad('amount')}
              min={100000}
              max={20000000}
              sliderStep={50000}
              suffix="₹"
              hint={Number(amount) > 0 ? `${inr(Number(amount))} · ${inrWords(Number(amount))}` : undefined}
              error={errors.amount}
            />
            <SliderField field="rate" value={rateValue} onChange={setRateValue} onBadInput={markBad('rate')} min={0} max={20} sliderStep={0.05} suffix="% p.a." error={errors.rate} />
            <SliderField
              field="tenure"
              value={tenure}
              onChange={setTenure}
              onBadInput={markBad('tenure')}
              min={1}
              max={unit === 'years' ? 30 : 360}
              sliderStep={1}
              suffix={unit === 'years' ? 'years' : 'months'}
              error={errors.tenure}
            />
            <fieldset className="segmented">
              <legend>Tenure unit</legend>
              {(['years', 'months'] as const).map((u) => (
                <label key={u} className={unit === u ? 'is-checked' : undefined}>
                  <input type="radio" name="tenure-unit" value={u} checked={unit === u} onChange={() => switchUnit(u)} />
                  {u === 'years' ? 'Years' : 'Months'}
                </label>
              ))}
            </fieldset>
            <div className={`field ${errors.start ? 'has-error' : ''}`}>
              <div className="field-row">
                <label htmlFor="start-month">{LABEL.start}</label>
                <input
                  id="start-month"
                  type="month"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  aria-invalid={Boolean(errors.start)}
                  aria-describedby={errors.start ? 'start-month-error' : 'start-month-hint'}
                />
              </div>
              {errors.start ? (
                <p id="start-month-error" className="field-error">
                  {errors.start}
                </p>
              ) : (
                <p id="start-month-hint" className="field-hint">
                  Payments are grouped by calendar year from this month.
                </p>
              )}
            </div>
          </form>
        </Panel>

        <section className="calc-results panel" aria-labelledby="results-heading" aria-busy={pending}>
          <h2 id="results-heading">Repayment summary</h2>
          {hasErrors ? (
            <p className="results-blocked" role="status">
              Fix the highlighted {Object.keys(errors).length === 1 ? 'field' : 'fields'} to see the repayment plan.
            </p>
          ) : data ? (
            <>
              <dl className="results-figures">
                <div className="figure-emi" role="group" aria-labelledby="fig-emi">
                  <dt id="fig-emi">Monthly EMI</dt>
                  <dd data-testid="result-value">{inr(data.emi)}</dd>
                </div>
                <div role="group" aria-labelledby="fig-interest">
                  <dt id="fig-interest">Total interest</dt>
                  <dd data-testid="result-value">{inr(data.totalInterest)}</dd>
                </div>
                <div role="group" aria-labelledby="fig-total">
                  <dt id="fig-total">Total payment</dt>
                  <dd data-testid="result-value">{inr(data.totalPayment)}</dd>
                </div>
              </dl>
              <DonutChart
                title="Break-up of total payment"
                valueLabel="Amount"
                format={inr}
                centerCaption="Total payment"
                centerValue={inrShort(data.totalPayment)}
                slices={[
                  { key: 'principal', label: 'Principal amount', value: data.inputs.principal, color: 'var(--c-principal)' },
                  { key: 'interest', label: 'Total interest', value: data.totalInterest, color: 'var(--c-interest)' },
                ]}
              />
            </>
          ) : (
            <p className="results-blocked" role="status">
              Calculating…
            </p>
          )}
        </section>
      </div>

      {data && !hasErrors && (
        <>
          <Panel>
            <BarChart
              title="Yearly payments"
              description={`${data.inputs.tenureMonths} monthly payments from ${monthYear(data.inputs.startMonth)}, grouped by calendar year.`}
              format={inr}
              formatAxis={inrShort}
              legend={[
                { key: 'principal', label: 'Principal', color: 'var(--c-principal)' },
                { key: 'interest', label: 'Interest', color: 'var(--c-interest)' },
              ]}
              bars={data.schedule.map((row) => ({
                key: String(row.year),
                label: String(row.year),
                segments: [
                  { key: 'principal', label: 'Principal', value: row.principal, color: 'var(--c-principal)' },
                  { key: 'interest', label: 'Interest', value: row.interest, color: 'var(--c-interest)' },
                ],
                extra: [
                  { label: 'Payments', value: String(row.payments) },
                  { label: 'Balance', value: inr(row.closingBalance) },
                ],
              }))}
            />
          </Panel>
          <Panel className="panel-table">
            <div className="panel-head">
              <h2 id="schedule-heading">Yearly amortisation schedule</h2>
            </div>
            <div className="table-scroll">
              <table className="data-table" aria-labelledby="schedule-heading">
                <thead>
                  <tr>
                    <th scope="col">Year</th>
                    <th scope="col" className="num">
                      Payments
                    </th>
                    <th scope="col" className="num">
                      Principal
                    </th>
                    <th scope="col" className="num">
                      Interest
                    </th>
                    <th scope="col" className="num">
                      Total paid
                    </th>
                    <th scope="col" className="num">
                      Closing balance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.schedule.map((row) => (
                    <tr key={row.year}>
                      <th scope="row">{row.year}</th>
                      <td className="num">{row.payments}</td>
                      <td className="num">{inr(row.principal)}</td>
                      <td className="num">{inr(row.interest)}</td>
                      <td className="num">{inr(row.totalPayment)}</td>
                      <td className="num">{inr(row.closingBalance)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Total</th>
                    <td className="num">{data.schedule.reduce((sum, row) => sum + row.payments, 0)}</td>
                    <td className="num">{inr(data.schedule.reduce((sum, row) => sum + row.principal, 0))}</td>
                    <td className="num">{inr(data.totalInterest)}</td>
                    <td className="num">{inr(data.totalPayment)}</td>
                    <td className="num">{inr(data.schedule.at(-1)?.closingBalance ?? 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Panel>
        </>
      )}
    </>
  );
}
