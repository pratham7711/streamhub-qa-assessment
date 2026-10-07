import Anthropic from '@anthropic-ai/sdk';
import { buildUserPrompt, OUTPUT_SCHEMA, SYSTEM_PROMPT } from '../prompt.js';
import type { HealProvider, Incident, ProviderResult } from '../types.js';
import { readCandidates } from './llm-output.js';

/**
 * Calls the Claude Messages API through the official SDK (for CI, where no
 * Claude Code login exists). The answer is forced through a single tool whose
 * input schema is the output schema, so the model must return structured
 * candidates; parseSpec still re-validates them.
 */
export function anthropicApi(apiKey: string, model = process.env.HEAL_MODEL || 'claude-sonnet-5-5', timeoutMs = 120_000): HealProvider {
  const name = `anthropic-api (${model})`;
  const client = new Anthropic({ apiKey, timeout: timeoutMs, maxRetries: 2 });
  return {
    name,
    async suggest(incident: Incident): Promise<ProviderResult> {
      const started = Date.now();
      const message = await client.messages.create({
        model,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        tools: [
          {
            name: 'propose_locators',
            description: 'Return replacement locator candidates for the failed locator.',
            input_schema: OUTPUT_SCHEMA as unknown as Anthropic.Tool.InputSchema,
          },
        ],
        tool_choice: { type: 'tool', name: 'propose_locators' },
        messages: [{ role: 'user', content: buildUserPrompt(incident) }],
      });
      const answer = message.content.find((block) => block.type === 'tool_use')?.input;
      return { provider: name, ...readCandidates(answer, name), durationMs: Date.now() - started };
    },
  };
}
