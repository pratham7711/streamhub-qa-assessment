import type { Incident } from './types.js';

export const SYSTEM_PROMPT = `You repair broken Playwright locators in an automated UI test suite.

You receive the element's intent (what the test needs from it), the locator that failed and how it failed, the page's accessibility tree as a Playwright ARIA snapshot, and an inventory of elements on the page with their roles, accessible names, labels and test ids.

Rules:
1. Answer only in the locator vocabulary of the output schema: by "role" (ARIA role plus accessible name), "label", "placeholder", "testid" or "text", optionally scoped "within" another locator of the same vocabulary. CSS, XPath, nth(), first() and last() are not available.
2. Prefer, in this order: role with its exact accessible name; label; test id; text. Use "within" only to tell apart elements that would otherwise match more than once.
3. The locator must match exactly one element on this page, and that element must serve the stated intent and satisfy the expected fingerprint. Do not choose an element only because its text resembles the old selector.
4. Copy roles, names, labels and test ids verbatim from the snapshot or inventory. Never invent them.
5. If no element on the page serves the intent, return an empty list. An honest "cannot heal" is better than a guess, because a wrong fix makes the test pass for the wrong reason.
6. Return at most 3 candidates, best first, each with a one-sentence rationale and a confidence between 0 and 1.`;

const KIND_TEXT: Record<Incident['kind'], string> = {
  'no-match': 'it matched no element',
  ambiguous: 'it matched more than one element (strict mode would refuse to act)',
  'not-visible': 'it matched an element that is not visible',
  'wrong-element': 'it matched an element that does not satisfy the expected fingerprint',
};

/** Builds the user turn. Only page structure is sent: no cookies, storage, network data or field values. */
export function buildUserPrompt(incident: Incident, maxSnapshot = 12_000, maxInventory = 160): string {
  const fingerprint = Object.entries(incident.expect).map(([k, v]) => `${k}: ${v}`).join('; ') || 'none declared';
  const snapshot = incident.ariaSnapshot.length > maxSnapshot ? `${incident.ariaSnapshot.slice(0, maxSnapshot)}\n# ...truncated` : incident.ariaSnapshot;
  const inventory = incident.inventory
    .slice(0, maxInventory)
    .map((i) => JSON.stringify({
      ref: i.ref, tag: i.tag, role: i.role, name: i.name || undefined, testid: i.testid ?? undefined, label: i.label ?? undefined,
      placeholder: i.placeholder ?? undefined, container: i.container ? `${i.container.role} "${i.container.name}"` : undefined,
      matchedFailedLocator: i.matchedBroken || undefined,
    }))
    .join('\n');
  return `<intent key="${incident.key}">${incident.description}</intent>
<expected_fingerprint>${fingerprint}</expected_fingerprint>
<failed_locator matches="${incident.matchCount}">${incident.brokenLocator}</failed_locator>
<failure>The locator failed because ${KIND_TEXT[incident.kind]}. ${incident.detail}</failure>
<page url="${incident.url}" />
<aria_snapshot>
${snapshot}
</aria_snapshot>
<inventory>
${inventory}
</inventory>

Propose replacement locators for the failed one.`;
}

const BASE_LOCATOR = {
  type: 'object',
  properties: {
    by: { type: 'string', enum: ['role', 'label', 'placeholder', 'testid', 'text'] },
    role: { type: 'string', description: 'ARIA role, only with by=role' },
    name: { type: 'string', description: 'Exact accessible name, only with by=role' },
    value: { type: 'string', description: 'Label, placeholder, test id or text, for the other strategies' },
    exact: { type: 'boolean' },
  },
  required: ['by'],
  additionalProperties: false,
} as const;

/** JSON Schema for the structured answer (one level of `within`). */
export const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        properties: {
          locator: {
            ...BASE_LOCATOR,
            properties: { ...BASE_LOCATOR.properties, within: BASE_LOCATOR },
          },
          rationale: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
        required: ['locator', 'rationale', 'confidence'],
        additionalProperties: false,
      },
    },
  },
  required: ['candidates'],
  additionalProperties: false,
} as const;
