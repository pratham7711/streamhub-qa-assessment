import { Router } from 'express';
import { calculateEmi } from '../lib/emi.js';
import { parseQuery, ValidationError } from '../lib/query.js';

export const emiRouter = Router();

const TENURE_LIMIT_MONTHS = 480;

emiRouter.get('/', (req, res) => {
  const params = parseQuery(req, {
    principal: { kind: 'number', required: true, min: 1_000, max: 100_000_000, decimals: 2 },
    rate: { kind: 'number', required: true, min: 0, max: 50 },
    // Range-checked below in months, so the message names the unit.
    tenure: { kind: 'number', required: true },
    tenureUnit: { kind: 'enum', values: ['years', 'months'], default: 'years' },
    startMonth: { kind: 'month' },
  });

  const tenure = params.tenure as number;
  const months = params.tenureUnit === 'years' ? tenure * 12 : tenure;
  if (!Number.isInteger(months) || months < 1 || months > TENURE_LIMIT_MONTHS) {
    throw new ValidationError([
      {
        param: 'tenure',
        issue: 'out_of_range',
        message: `"tenure" must be a whole number of months between 1 and ${TENURE_LIMIT_MONTHS} (got ${Math.round(months * 100) / 100} months)`,
        received: tenure,
      },
    ]);
  }

  const now = new Date();
  const [startYear, startMonth] = params.startMonth
    ? (params.startMonth as string).split('-').map(Number)
    : [now.getFullYear(), now.getMonth() + 1];

  const principal = params.principal as number;
  const rate = params.rate as number;
  res.json({
    data: {
      inputs: { principal, rate, tenureMonths: months, startMonth: `${startYear}-${String(startMonth).padStart(2, '0')}` },
      ...calculateEmi(principal, rate, months, startYear, startMonth),
    },
  });
});
