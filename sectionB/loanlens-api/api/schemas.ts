/**
 * JSON Schemas for LoanLens responses. Every API scenario validates the shape of
 * the body, not only the status, for both successful and error responses.
 */
import { Ajv, type ErrorObject } from 'ajv';
import addFormatsModule from 'ajv-formats';

const addFormats = addFormatsModule as unknown as (ajv: Ajv) => Ajv;

const loan = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'borrower', 'type', 'amount', 'rate', 'tenureMonths', 'disbursedOn', 'status', 'city', 'emi'],
  properties: {
    id: { type: 'string', pattern: '^LN-\\d{4}$' },
    borrower: { type: 'string', minLength: 1 },
    type: { enum: ['home', 'personal', 'car', 'education'] },
    amount: { type: 'number', exclusiveMinimum: 0 },
    rate: { type: 'number', minimum: 0, maximum: 50 },
    tenureMonths: { type: 'integer', minimum: 1 },
    disbursedOn: { type: 'string', format: 'date' },
    status: { enum: ['active', 'closed', 'overdue', 'pending'] },
    city: { type: 'string', minLength: 1 },
    emi: { type: 'number', exclusiveMinimum: 0 },
  },
} as const;

const yearRow = {
  type: 'object',
  additionalProperties: false,
  required: ['year', 'payments', 'principal', 'interest', 'totalPayment', 'closingBalance'],
  properties: {
    year: { type: 'integer' },
    payments: { type: 'integer', minimum: 1, maximum: 12 },
    principal: { type: 'number', minimum: 0 },
    interest: { type: 'number', minimum: 0 },
    totalPayment: { type: 'number', minimum: 0 },
    closingBalance: { type: 'number', minimum: 0 },
  },
} as const;

const group = (key: string) =>
  ({
    type: 'object',
    additionalProperties: false,
    required: [key, 'count', 'principal'],
    properties: { [key]: { type: 'string' }, count: { type: 'integer', minimum: 0 }, principal: { type: 'number', minimum: 0 } },
  }) as const;

export const schemas = {
  'error': {
    type: 'object',
    additionalProperties: false,
    required: ['error'],
    properties: {
      error: {
        type: 'object',
        additionalProperties: false,
        required: ['code', 'message'],
        properties: {
          code: { type: 'string', pattern: '^[A-Z_]+$' },
          message: { type: 'string', minLength: 1 },
          details: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['param', 'issue', 'message'],
              properties: {
                param: { type: 'string' },
                issue: { enum: ['missing', 'unknown_parameter', 'duplicate_parameter', 'invalid_type', 'out_of_range', 'invalid_value', 'invalid_range'] },
                message: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
  'loan list': {
    type: 'object',
    additionalProperties: false,
    required: ['data', 'meta'],
    properties: {
      data: { type: 'array', items: loan },
      meta: {
        type: 'object',
        additionalProperties: false,
        required: ['page', 'pageSize', 'total', 'totalPages', 'sort', 'filters'],
        properties: {
          page: { type: 'integer', minimum: 1 },
          pageSize: { type: 'integer', minimum: 1, maximum: 100 },
          total: { type: 'integer', minimum: 0 },
          totalPages: { type: 'integer', minimum: 1 },
          sort: { type: 'string' },
          filters: { type: 'object' },
        },
      },
    },
  },
  'loan': {
    type: 'object',
    additionalProperties: false,
    required: ['data'],
    properties: { data: loan },
  },
  'loan summary': {
    type: 'object',
    additionalProperties: false,
    required: ['data', 'meta'],
    properties: {
      data: {
        type: 'object',
        additionalProperties: false,
        required: ['count', 'totalPrincipal', 'weightedAverageRate', 'monthlyEmiInflow', 'byType', 'byStatus'],
        properties: {
          count: { type: 'integer', minimum: 0 },
          totalPrincipal: { type: 'number', minimum: 0 },
          weightedAverageRate: { type: 'number', minimum: 0 },
          monthlyEmiInflow: { type: 'number', minimum: 0 },
          byType: { type: 'array', minItems: 4, maxItems: 4, items: group('type') },
          byStatus: { type: 'array', minItems: 4, maxItems: 4, items: group('status') },
        },
      },
      meta: { type: 'object', required: ['filters'] },
    },
  },
  'emi': {
    type: 'object',
    additionalProperties: false,
    required: ['data'],
    properties: {
      data: {
        type: 'object',
        additionalProperties: false,
        required: ['inputs', 'emi', 'totalInterest', 'totalPayment', 'schedule'],
        properties: {
          inputs: {
            type: 'object',
            additionalProperties: false,
            required: ['principal', 'rate', 'tenureMonths', 'startMonth'],
            properties: {
              principal: { type: 'number' },
              rate: { type: 'number' },
              tenureMonths: { type: 'integer' },
              startMonth: { type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$' },
            },
          },
          emi: { type: 'number', exclusiveMinimum: 0 },
          totalInterest: { type: 'number', minimum: 0 },
          totalPayment: { type: 'number', exclusiveMinimum: 0 },
          schedule: { type: 'array', minItems: 1, items: yearRow },
        },
      },
    },
  },
  'health': {
    type: 'object',
    required: ['status'],
    properties: { status: { const: 'ok' } },
  },
  'meta': {
    type: 'object',
    additionalProperties: false,
    required: ['data'],
    properties: {
      data: {
        type: 'object',
        additionalProperties: false,
        required: ['loanTypes', 'statuses', 'cities'],
        properties: {
          loanTypes: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', minLength: 1 } },
          statuses: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', minLength: 1 } },
          cities: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', minLength: 1 } },
        },
      },
    },
  },
} as const;

export type SchemaName = keyof typeof schemas;

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validators = Object.fromEntries(Object.entries(schemas).map(([name, schema]) => [name, ajv.compile(schema)]));

export function validateSchema(name: string, body: unknown): string[] {
  const validate = validators[name];
  if (!validate) throw new Error(`Unknown schema "${name}". Known: ${Object.keys(schemas).join(', ')}`);
  return validate(body) ? [] : (validate.errors ?? []).map((e: ErrorObject) => `${e.instancePath || '(root)'} ${e.message}`);
}
