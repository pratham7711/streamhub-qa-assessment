import type { Locator, Page } from 'playwright';
import type { LocatorSpec } from './types.js';

type Root = Page | Locator;

/** ARIA roles a suggestion may use. Anything else is rejected before it reaches the page. */
const ROLES = new Set([
  'alert', 'article', 'banner', 'button', 'cell', 'checkbox', 'columnheader', 'combobox', 'complementary',
  'contentinfo', 'dialog', 'figure', 'form', 'grid', 'group', 'heading', 'img', 'link', 'list', 'listbox',
  'listitem', 'main', 'menu', 'menuitem', 'meter', 'navigation', 'option', 'progressbar', 'radio', 'radiogroup',
  'region', 'row', 'rowgroup', 'rowheader', 'search', 'searchbox', 'slider', 'spinbutton', 'status', 'switch',
  'tab', 'table', 'tablist', 'tabpanel', 'textbox', 'toolbar', 'tooltip',
]);
const STRATEGIES = new Set(['role', 'label', 'placeholder', 'testid', 'text']);

function cleanString(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const s = value.trim();
  if (!s) throw new Error(`${field} is empty`);
  if (s.length > 120) throw new Error(`${field} is longer than 120 characters`);
  if (/[\n\r]/.test(s)) throw new Error(`${field} contains a line break`);
  return s;
}

/** Validates untrusted healer output into a LocatorSpec, or throws with the reason. */
export function parseSpec(raw: unknown, depth = 0): LocatorSpec {
  if (depth > 2) throw new Error('within is nested more than two levels deep');
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('locator must be an object');
  const r = raw as Record<string, unknown>;
  const extra = Object.keys(r).filter((k) => !['by', 'role', 'name', 'value', 'exact', 'within'].includes(k));
  if (extra.length) throw new Error(`unsupported field(s): ${extra.join(', ')}`);
  if (typeof r.by !== 'string' || !STRATEGIES.has(r.by)) throw new Error(`"by" must be one of ${[...STRATEGIES].join(', ')} (got ${JSON.stringify(r.by)})`);
  if (r.exact !== undefined && typeof r.exact !== 'boolean') throw new Error('exact must be a boolean');
  const within = r.within === undefined || r.within === null ? undefined : parseSpec(r.within, depth + 1);
  const exact = r.exact as boolean | undefined;

  if (r.by === 'role') {
    const role = cleanString(r.role, 'role');
    if (!ROLES.has(role)) throw new Error(`"${role}" is not an allowed ARIA role`);
    const name = r.name === undefined || r.name === null || r.name === '' ? undefined : cleanString(r.name, 'name');
    return { by: 'role', role, ...(name ? { name } : {}), ...(exact !== undefined ? { exact } : {}), ...(within ? { within } : {}) };
  }
  if (r.role !== undefined || r.name !== undefined) throw new Error(`"role"/"name" only apply to by: "role"`);
  const value = cleanString(r.value, 'value');
  return { by: r.by as Exclude<LocatorSpec['by'], 'role'>, value, ...(exact !== undefined ? { exact } : {}), ...(within ? { within } : {}) };
}

export function buildLocator(page: Page, spec: LocatorSpec): Locator {
  const root: Root = spec.within ? buildLocator(page, spec.within) : page;
  switch (spec.by) {
    case 'role':
      return root.getByRole(spec.role as Parameters<Page['getByRole']>[0], {
        ...(spec.name !== undefined ? { name: spec.name } : {}),
        ...(spec.exact !== undefined ? { exact: spec.exact } : {}),
      });
    case 'label':
      return root.getByLabel(spec.value, { exact: spec.exact });
    case 'placeholder':
      return root.getByPlaceholder(spec.value, { exact: spec.exact });
    case 'testid':
      return root.getByTestId(spec.value);
    case 'text':
      return root.getByText(spec.value, { exact: spec.exact });
  }
}

const quote = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/** Renders a spec as the TypeScript a page object would contain. */
export function specToCode(spec: LocatorSpec, root = 'page'): string {
  const base = spec.within ? specToCode(spec.within, root) : root;
  const exact = spec.exact ? ', exact: true' : '';
  switch (spec.by) {
    case 'role':
      return spec.name !== undefined
        ? `${base}.getByRole(${quote(spec.role)}, { name: ${quote(spec.name)}${exact} })`
        : `${base}.getByRole(${quote(spec.role)})`;
    case 'testid':
      return `${base}.getByTestId(${quote(spec.value)})`;
    default: {
      const method = { label: 'getByLabel', placeholder: 'getByPlaceholder', text: 'getByText' }[spec.by];
      return `${base}.${method}(${quote(spec.value)}${spec.exact ? ', { exact: true }' : ''})`;
    }
  }
}

/** Lower is better: role + name is what a user perceives, text is the most fragile. */
export function strategyRank(spec: LocatorSpec): number {
  const own = { role: 0, label: 1, placeholder: 2, testid: 3, text: 4 }[spec.by];
  return own + (spec.within ? 0.5 : 0);
}
