/**
 * Declarative query-string validation for the in-browser data source. Every
 * query lists the parameters it accepts; anything else is rejected, and all
 * problems are reported together so a screen can show every one at once.
 */

export type Issue =
  | 'missing'
  | 'unknown_parameter'
  | 'duplicate_parameter'
  | 'invalid_type'
  | 'out_of_range'
  | 'invalid_value'
  | 'invalid_range';

export interface ValidationDetail {
  param: string;
  issue: Issue;
  message: string;
  received?: unknown;
}

type Spec =
  | { kind: 'int'; required?: boolean; min?: number; max?: number; default?: number }
  | { kind: 'number'; required?: boolean; min?: number; max?: number; default?: number; decimals?: number }
  | { kind: 'string'; required?: boolean; minLength?: number; maxLength?: number }
  | { kind: 'enum'; values: readonly string[]; required?: boolean; default?: string }
  | { kind: 'enumList'; values: readonly string[] }
  | { kind: 'date' }
  | { kind: 'month' }
  | { kind: 'sort'; fields: readonly string[]; default: string };

export type Schema = Record<string, Spec>;

export class ValidationError extends Error {
  constructor(public readonly details: ValidationDetail[]) {
    super(details.map((d) => d.message).join('; '));
  }
}

const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const ISO_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const NUMERIC = /^-?\d+(\.\d+)?$/;
const INTEGER = /^-?\d+$/;

/** A parameter given more than once becomes an array, so a duplicate can be refused. */
function readSearch(search: string): Record<string, string | string[]> {
  const raw: Record<string, string | string[]> = Object.create(null);
  for (const [key, value] of new URLSearchParams(search)) {
    const previous = raw[key];
    raw[key] = previous === undefined ? value : [...[previous].flat(), value];
  }
  return raw;
}

export function parseQuery(search: string, schema: Schema): Record<string, unknown> {
  const raw = readSearch(search);
  const details: ValidationDetail[] = [];
  const values: Record<string, unknown> = {};

  for (const key of Object.keys(raw)) {
    if (!Object.hasOwn(schema, key)) {
      details.push({ param: key, issue: 'unknown_parameter', message: `Unknown query parameter "${key}". Allowed: ${Object.keys(schema).join(', ')}` });
    }
  }

  for (const [param, spec] of Object.entries(schema)) {
    let input = raw[param];
    if (Array.isArray(input)) {
      if (spec.kind !== 'enumList') {
        details.push({ param, issue: 'duplicate_parameter', message: `"${param}" may only be given once`, received: input });
        continue;
      }
      input = input.join(',');
    }
    if (input === undefined || input === '') {
      if ('required' in spec && spec.required) {
        details.push({ param, issue: 'missing', message: `"${param}" is required` });
      } else if ('default' in spec && spec.default !== undefined) {
        values[param] = spec.default;
      }
      continue;
    }
    const text = input.trim();

    switch (spec.kind) {
      case 'int':
      case 'number': {
        const pattern = spec.kind === 'int' ? INTEGER : NUMERIC;
        if (!pattern.test(text)) {
          details.push({ param, issue: 'invalid_type', message: `"${param}" must be ${spec.kind === 'int' ? 'an integer' : 'a number'}`, received: text });
          break;
        }
        if (spec.kind === 'number' && spec.decimals !== undefined && (text.split('.')[1]?.length ?? 0) > spec.decimals) {
          details.push({ param, issue: 'invalid_type', message: `"${param}" must have at most ${spec.decimals} decimal places`, received: text });
          break;
        }
        const num = Number(text);
        if ((spec.min !== undefined && num < spec.min) || (spec.max !== undefined && num > spec.max)) {
          details.push({ param, issue: 'out_of_range', message: `"${param}" must be between ${spec.min ?? '-∞'} and ${spec.max ?? '∞'}`, received: num });
          break;
        }
        values[param] = num;
        break;
      }
      case 'string': {
        if ((spec.minLength && text.length < spec.minLength) || (spec.maxLength && text.length > spec.maxLength)) {
          details.push({ param, issue: 'out_of_range', message: `"${param}" must be ${spec.minLength ?? 0}-${spec.maxLength ?? '∞'} characters`, received: text });
          break;
        }
        values[param] = text;
        break;
      }
      case 'enum': {
        if (!spec.values.includes(text)) {
          details.push({ param, issue: 'invalid_value', message: `"${param}" must be one of: ${spec.values.join(', ')}`, received: text });
          break;
        }
        values[param] = text;
        break;
      }
      case 'enumList': {
        const items = text.split(',').map((s) => s.trim()).filter(Boolean);
        const bad = items.filter((item) => !spec.values.includes(item));
        if (bad.length || !items.length) {
          details.push({ param, issue: 'invalid_value', message: `"${param}" accepts a comma-separated list of: ${spec.values.join(', ')}`, received: text });
          break;
        }
        values[param] = [...new Set(items)];
        break;
      }
      case 'date': {
        const valid = ISO_DATE.test(text) && !Number.isNaN(Date.parse(`${text}T00:00:00Z`)) && new Date(`${text}T00:00:00Z`).toISOString().startsWith(text);
        if (!valid) {
          details.push({ param, issue: 'invalid_type', message: `"${param}" must be a real calendar date (YYYY-MM-DD)`, received: text });
          break;
        }
        values[param] = text;
        break;
      }
      case 'month': {
        if (!ISO_MONTH.test(text)) {
          details.push({ param, issue: 'invalid_type', message: `"${param}" must be a month (YYYY-MM)`, received: text });
          break;
        }
        values[param] = text;
        break;
      }
      case 'sort': {
        const field = text.startsWith('-') ? text.slice(1) : text;
        if (!spec.fields.includes(field)) {
          details.push({ param, issue: 'invalid_value', message: `"${param}" must be one of ${spec.fields.join(', ')} (prefix with - for descending)`, received: text });
          break;
        }
        values[param] = text;
        break;
      }
    }
  }

  if (details.length) throw new ValidationError(details);
  return values;
}

export function assertOrdered(
  values: Record<string, unknown>,
  lowKey: string,
  highKey: string,
): void {
  const low = values[lowKey];
  const high = values[highKey];
  if (low !== undefined && high !== undefined && (low as number | string) > (high as number | string)) {
    throw new ValidationError([
      { param: lowKey, issue: 'invalid_range', message: `"${lowKey}" (${low}) must not be greater than "${highKey}" (${high})`, received: low },
    ]);
  }
}
