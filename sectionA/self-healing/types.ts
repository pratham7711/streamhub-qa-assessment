/** Shared types for the self-healing proof of concept. See docs/SELF_HEALING.md. */

export type Strategy = 'role' | 'label' | 'placeholder' | 'testid' | 'text';

/**
 * The only vocabulary a healer may answer in. A suggestion is data, never code:
 * no CSS, no XPath, no nth()/first()/last(), nothing that is eval'd. `within`
 * scopes a locator to a container, which is how an ambiguous match is resolved.
 */
export type LocatorSpec =
  | { by: 'role'; role: string; name?: string; exact?: boolean; within?: LocatorSpec }
  | { by: Exclude<Strategy, 'role'>; value: string; exact?: boolean; within?: LocatorSpec };

/** What a page object needs from an element, declared next to the locator. */
export interface LocatorIntent {
  /** Stable id, e.g. "dashboard.kpi.totalLoans". */
  key: string;
  /** Plain-language purpose, given to the healer as the main signal. */
  description: string;
  /**
   * Fingerprint the element must satisfy, both when the locator resolves and when a fix is
   * validated. `within` names the container it must sit in; without it, a fingerprint such as
   * "digits only" also fits every other number on the page.
   */
  expect: { role?: string; name?: string | RegExp; text?: RegExp; within?: { role: string; name: string } };
}

export type FailureKind = 'no-match' | 'ambiguous' | 'not-visible' | 'wrong-element';

export interface InventoryItem {
  ref: number;
  tag: string;
  role: string | null;
  name: string;
  testid: string | null;
  label: string | null;
  placeholder: string | null;
  text: string;
  container: { role: string; name: string } | null;
  visible: boolean;
  /** True when the failed locator itself matched this element (ambiguous or wrong-element failures). */
  matchedBroken: boolean;
}

export interface SourceRef {
  file: string;
  line: number;
  text: string;
  /** The locator expression inside the arrow function, e.g. `p.getByTestId('kpi-total')`. */
  expression: string | null;
  /** The arrow function's parameter name, e.g. `p`. */
  param: string | null;
}

export interface Incident {
  key: string;
  description: string;
  expect: { role?: string; name?: string; text?: string; within?: string };
  brokenLocator: string;
  kind: FailureKind;
  matchCount: number;
  detail: string;
  url: string;
  scenario: string;
  source: SourceRef | null;
  ariaSnapshot: string;
  inventory: InventoryItem[];
  screenshot: string | null;
  at: string;
}

export interface Candidate {
  spec: LocatorSpec;
  rationale: string;
  confidence: number;
  provider: string;
}

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

export interface Verdict {
  candidate: Candidate;
  code: string;
  ok: boolean;
  checks: Check[];
}

export interface ProviderResult {
  provider: string;
  candidates: Candidate[];
  /** Raw entries the provider returned that were not valid LocatorSpecs. */
  malformed: { raw: unknown; reason: string }[];
  durationMs: number;
  costUsd?: number;
  note?: string;
}

export interface HealProvider {
  name: string;
  suggest(incident: Incident): Promise<ProviderResult>;
}

export interface Suggestion {
  key: string;
  scenario: string;
  brokenLocator: string;
  kind: FailureKind;
  detail: string;
  mode: 'suggest' | 'heal';
  provider: string;
  providerNote?: string;
  durationMs: number;
  costUsd?: number;
  accepted: Verdict | null;
  /** Every other candidate: failed validation, or passed but ranked below the accepted one. */
  alternatives: Verdict[];
  malformed: { raw: unknown; reason: string }[];
  source: SourceRef | null;
  patch: string | null;
  incidentFile: string;
  /** Heal mode only: did the scenario pass when it ran on the healed locator? */
  replay: 'passed' | 'failed' | 'pending' | 'not-run';
}
