import { parseSpec } from '../spec.js';
import type { Candidate } from '../types.js';

/** Turns a model's structured answer into candidates, keeping every rejected entry and its reason. */
export function readCandidates(answer: unknown, provider: string) {
  const candidates: Candidate[] = [];
  const malformed: { raw: unknown; reason: string }[] = [];
  const list = (answer as { candidates?: unknown })?.candidates;
  if (!Array.isArray(list)) {
    malformed.push({ raw: answer, reason: 'answer has no "candidates" array' });
    return { candidates, malformed };
  }
  for (const entry of list) {
    const e = entry as { locator?: unknown; rationale?: unknown; confidence?: unknown };
    try {
      const spec = parseSpec(e.locator);
      const confidence = typeof e.confidence === 'number' ? Math.min(1, Math.max(0, e.confidence)) : 0;
      candidates.push({ spec, rationale: String(e.rationale ?? ''), confidence, provider });
    } catch (error) {
      malformed.push({ raw: entry, reason: (error as Error).message });
    }
  }
  return { candidates, malformed };
}
