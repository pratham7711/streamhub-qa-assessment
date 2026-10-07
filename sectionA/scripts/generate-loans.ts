/**
 * Deterministic generator for the mock loan data. Run with `npm run data:generate`.
 * Writes app/public/data/loans.json, read by the web app, in the browser. The output is
 * committed so the app and the tests always see the same data; the seed makes regeneration
 * reproducible. Section B carries the same generator and seed, so the two sections' data
 * files are identical.
 */
import { writeFileSync } from 'node:fs';

type LoanType = 'home' | 'personal' | 'car' | 'education';
type LoanStatus = 'active' | 'closed' | 'overdue' | 'pending';

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261006);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
const between = (min: number, max: number) => min + rand() * (max - min);
const roundTo = (value: number, step: number) => Math.round(value / step) * step;

const FIRST = ['Aarav', 'Vivaan', 'Aditya', 'Ishaan', 'Kabir', 'Rohan', 'Arjun', 'Karan', 'Ananya', 'Diya', 'Saanvi', 'Meera', 'Priya', 'Neha', 'Kavya', 'Riya', 'Tara', 'Nikhil', 'Siddharth', 'Pooja'];
const LAST = ['Sharma', 'Verma', 'Mehta', 'Iyer', 'Reddy', 'Nair', 'Gupta', 'Kapoor', 'Joshi', 'Bose', 'Malhotra', 'Rao', 'Chopra', 'Desai', 'Pillai', 'Saxena'];
const CITIES = ['Mumbai', 'Delhi', 'Bengaluru', 'Pune', 'Hyderabad', 'Chennai', 'Kolkata', 'Jaipur'];

const PRODUCTS: Record<LoanType, { amount: [number, number, number]; rate: [number, number]; tenureYears: readonly number[] }> = {
  home: { amount: [1_500_000, 12_000_000, 100_000], rate: [7.5, 10.5], tenureYears: [10, 15, 20, 25, 30] },
  personal: { amount: [100_000, 2_500_000, 10_000], rate: [10.5, 18], tenureYears: [1, 2, 3, 4, 5] },
  car: { amount: [300_000, 2_000_000, 10_000], rate: [8, 12], tenureYears: [3, 4, 5, 7] },
  education: { amount: [200_000, 4_000_000, 50_000], rate: [8.5, 13], tenureYears: [5, 7, 10, 12] },
};

const TYPE_WEIGHTS: LoanType[] = ['home', 'home', 'home', 'personal', 'personal', 'personal', 'car', 'car', 'education'];
const STATUS_WEIGHTS: LoanStatus[] = ['active', 'active', 'active', 'active', 'active', 'closed', 'closed', 'overdue', 'pending'];

const LOAN_COUNT = 120;
const loans = Array.from({ length: LOAN_COUNT }, (_, i) => {
  const type = pick(TYPE_WEIGHTS);
  const product = PRODUCTS[type];
  const [minAmount, maxAmount, amountStep] = product.amount;
  const disbursed = new Date(Date.UTC(2023, 0, 1) + Math.floor(between(0, 1000)) * 86_400_000);
  return {
    id: `LN-${String(1001 + i)}`,
    borrower: `${pick(FIRST)} ${pick(LAST)}`,
    type,
    amount: roundTo(between(minAmount, maxAmount), amountStep),
    rate: roundTo(between(product.rate[0], product.rate[1]), 0.05),
    tenureMonths: pick(product.tenureYears) * 12,
    disbursedOn: disbursed.toISOString().slice(0, 10),
    status: pick(STATUS_WEIGHTS),
    city: pick(CITIES),
  };
}).map((loan) => ({ ...loan, rate: Number(loan.rate.toFixed(2)) }));

const out = 'app/public/data/loans.json';
writeFileSync(out, `${JSON.stringify(loans, null, 2)}\n`);
console.log(`Wrote ${loans.length} loans to ${out}`);
