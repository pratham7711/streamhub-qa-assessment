import type { Locator, Page } from 'playwright';
import type { InventoryItem } from './types.js';

const MARK = 'data-heal-match';

/**
 * Lists the elements a healer may choose from: everything with an ARIA role
 * (explicit or implicit) or a data-testid, with an approximate accessible name,
 * its label, and its nearest named container. Elements the failed locator matched
 * are flagged. Names here are approximations for ranking only; validation always
 * re-resolves a candidate through Playwright's own role/name engine.
 */
export async function collectInventory(page: Page, broken: Locator, limit = 250): Promise<InventoryItem[]> {
  await broken.evaluateAll((els, mark) => els.forEach((e) => e.setAttribute(mark, '')), MARK).catch(() => undefined);
  // tsx compiles with esbuild's keepNames, which wraps the named helpers below in
  // __name(); the browser has no such function. A string is not transformed.
  await page.evaluate('globalThis.__name ??= (fn) => fn');
  try {
    return await page.evaluate(
      ({ limit, mark }) => {
        const named = (el: Element) => el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby');
        const implicitRole = (el: Element): string | null => {
          const tag = el.tagName.toLowerCase();
          const type = (el.getAttribute('type') ?? 'text').toLowerCase();
          if (tag === 'a') return el.hasAttribute('href') ? 'link' : null;
          if (tag === 'input') {
            if (type === 'hidden') return null;
            const byType: Record<string, string> = { checkbox: 'checkbox', radio: 'radio', range: 'slider', number: 'spinbutton', button: 'button', submit: 'button', reset: 'button', search: 'searchbox' };
            return byType[type] ?? 'textbox';
          }
          if (tag === 'select') return (el as HTMLSelectElement).multiple ? 'listbox' : 'combobox';
          if (/^h[1-6]$/.test(tag)) return 'heading';
          const byTag: Record<string, string | null> = {
            button: 'button', textarea: 'textbox', table: 'table', tr: 'row', td: 'cell', th: 'columnheader', nav: 'navigation',
            main: 'main', header: 'banner', footer: 'contentinfo', img: 'img', ul: 'list', ol: 'list', li: 'listitem', dialog: 'dialog',
            output: 'status', article: 'article', figure: 'figure', aside: 'complementary',
            section: named(el) ? 'region' : null, form: named(el) ? 'form' : null,
          };
          return byTag[tag] ?? null;
        };
        const roleOf = (el: Element) => el.getAttribute('role')?.split(/\s+/)[0] || implicitRole(el);
        const textOf = (el: Element | null) => ((el as HTMLElement | null)?.innerText ?? el?.textContent ?? '').replace(/\s+/g, ' ').trim();
        const byIds = (ids: string) => ids.split(/\s+/).map((id) => document.getElementById(id)).map(textOf).join(' ').trim();
        const labelOf = (el: Element) => {
          const labels = (el as HTMLInputElement).labels;
          return labels && labels.length ? Array.from(labels).map(textOf).join(' ').trim() : null;
        };
        const NAME_FROM_CONTENT = new Set(['button', 'link', 'heading', 'cell', 'columnheader', 'rowheader', 'tab', 'option', 'menuitem', 'listitem', 'status', 'tooltip']);
        const nameOf = (el: Element, role: string | null) =>
          el.getAttribute('aria-label') ||
          (el.getAttribute('aria-labelledby') ? byIds(el.getAttribute('aria-labelledby')!) : '') ||
          labelOf(el) ||
          el.getAttribute('alt') ||
          el.getAttribute('title') ||
          (role === 'table' ? textOf(el.querySelector('caption')) : '') ||
          (role && NAME_FROM_CONTENT.has(role) ? textOf(el).slice(0, 80) : '');
        const CONTAINERS = new Set(['region', 'navigation', 'main', 'form', 'table', 'dialog', 'article', 'figure', 'group', 'tabpanel', 'complementary', 'search']);
        const containerOf = (el: Element) => {
          for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
            const role = roleOf(p);
            if (role && CONTAINERS.has(role)) {
              const name = nameOf(p, role);
              if (name) return { role, name };
            }
          }
          return null;
        };

        const items: (Omit<InventoryItem, 'ref'> & { weight: number })[] = [];
        for (const el of Array.from(document.body.querySelectorAll('*'))) {
          if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(el.tagName)) continue;
          const role = roleOf(el);
          const testid = el.getAttribute('data-testid');
          const matchedBroken = el.hasAttribute(mark);
          if (!role && !testid && !matchedBroken) continue;
          const visible = (el as HTMLElement).checkVisibility?.() ?? true;
          if (!visible && !matchedBroken) continue;
          const weight = (matchedBroken ? 0 : 10) + (testid ? 0 : 3) + (role && ['row', 'cell', 'listitem', 'list'].includes(role) ? 4 : 0);
          items.push({
            tag: el.tagName.toLowerCase(),
            role,
            name: nameOf(el, role),
            testid,
            label: labelOf(el),
            placeholder: el.getAttribute('placeholder'),
            text: textOf(el).slice(0, 100),
            container: containerOf(el),
            visible,
            matchedBroken,
            weight,
          });
        }
        return items
          .map((item, order) => ({ item, order }))
          .sort((a, b) => a.item.weight - b.item.weight || a.order - b.order)
          .slice(0, limit)
          .sort((a, b) => a.order - b.order)
          .map(({ item: { weight: _weight, ...item } }, ref) => ({ ref, ...item }));
      },
      { limit, mark: MARK },
    );
  } finally {
    await page.evaluate((mark) => document.querySelectorAll(`[${mark}]`).forEach((e) => e.removeAttribute(mark)), MARK).catch(() => undefined);
  }
}
