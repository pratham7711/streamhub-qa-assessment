import type { HealProvider, Incident, ProviderResult } from '../types.js';
import { anthropicApi } from './anthropic.js';
import { claudeCli, claudeCliAvailable } from './claude-cli.js';
import { heuristic } from './heuristic.js';

/**
 * HEAL_PROVIDER: "anthropic" (needs ANTHROPIC_API_KEY), "claude-cli" (needs the
 * Claude Code CLI and a login), "heuristic" (offline), or "auto": the API when a
 * key is set, else the CLI when installed, else the heuristic.
 */
export function pickProvider(name: string): HealProvider {
  const key = process.env.ANTHROPIC_API_KEY;
  switch (name) {
    case 'anthropic':
      if (!key) throw new Error('HEAL_PROVIDER=anthropic needs ANTHROPIC_API_KEY');
      return anthropicApi(key);
    case 'claude-cli':
      return claudeCli();
    case 'heuristic':
      return heuristic;
    case 'auto':
      if (key) return anthropicApi(key);
      return claudeCliAvailable() ? claudeCli() : heuristic;
    default:
      throw new Error(`Unknown HEAL_PROVIDER "${name}" (expected auto, anthropic, claude-cli or heuristic)`);
  }
}

/** Runs the chosen provider; if an LLM call fails, falls back to the heuristic and says so. */
export async function suggestWithFallback(provider: HealProvider, incident: Incident): Promise<ProviderResult> {
  try {
    return await provider.suggest(incident);
  } catch (error) {
    if (provider === heuristic) throw error;
    const fallback = await heuristic.suggest(incident);
    return { ...fallback, note: `${provider.name} failed (${(error as Error).message}); fell back to the heuristic provider.` };
  }
}
