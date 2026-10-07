import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Suggestion, Verdict } from './types.js';

const checkLine = (v: Verdict) => v.checks.map((c) => `${c.ok ? '✔' : '✖'} ${c.name}`).join(' · ');

/** Writes suggestions.json, one .patch per accepted fix, and a reviewer-facing SUGGESTIONS.md. */
export function renderSuggestions(dir: string, suggestions: Suggestion[]): void {
  mkdirSync(path.join(dir, 'patches'), { recursive: true });
  writeFileSync(path.join(dir, 'suggestions.json'), `${JSON.stringify(suggestions, null, 2)}\n`);
  for (const s of suggestions) if (s.patch) writeFileSync(path.join(dir, 'patches', `${s.key}.patch`), s.patch);

  const healed = suggestions.filter((s) => s.accepted).length;
  const replayed = suggestions.filter((s) => s.replay === 'passed').length;
  const rows = suggestions.map(
    (s) =>
      `| \`${s.key}\` | ${s.kind} | \`${s.brokenLocator}\` | ${s.accepted ? `\`${s.accepted.code}\`` : '**none passed validation**'} | ${s.replay} |`,
  );
  const sections = suggestions.map((s) => {
    const alternatives = s.alternatives.length
      ? s.alternatives
          .map((v) =>
            v.ok
              ? `- \`${v.code}\`: passed validation, ranked below the accepted one (confidence ${v.candidate.confidence})`
              : `- \`${v.code}\`: **rejected**: ${checkLine(v)}${v.checks.filter((c) => !c.ok).map((c) => ` (${c.detail})`).join('')}`,
          )
          .join('\n')
      : '- none';
    const malformed = s.malformed.length ? `\n\n**Malformed provider output (dropped):**\n${s.malformed.map((m) => `- ${m.reason}: \`${JSON.stringify(m.raw).slice(0, 160)}\``).join('\n')}` : '';
    return `### \`${s.key}\`

- **Scenario:** ${s.scenario}
- **Declared at:** ${s.source ? `\`${s.source.file}:${s.source.line}\`` : 'unknown'}
- **Failure:** ${s.kind}. ${s.detail}
- **Failed locator:** \`${s.brokenLocator}\`
- **Provider:** ${s.provider} (${(s.durationMs / 1000).toFixed(1)} s${s.costUsd !== undefined ? `, $${s.costUsd.toFixed(4)}` : ''})${s.providerNote ? `\n- **Note:** ${s.providerNote}` : ''}
- **Incident:** \`${s.incidentFile}\`

${s.accepted
  ? `**Accepted:** \`${s.accepted.code}\` (confidence ${s.accepted.candidate.confidence})

${s.accepted.candidate.rationale}

Validation: ${checkLine(s.accepted)}. Replay of the scenario on the healed locator: **${s.replay}**.

${s.patch ? `\`\`\`diff\n${s.patch}\`\`\`` : '_No patch: the declaring line could not be matched._'}`
  : '**No suggestion passed validation.** The test stays red; a person has to look at it.'}

**Other candidates:**
${alternatives}${malformed}`;
  });

  writeFileSync(
    path.join(dir, 'SUGGESTIONS.md'),
    `# Self-healing suggestions

Generated ${new Date().toISOString()}. ${healed} of ${suggestions.length} broken locators have a validated suggestion; ${replayed} replayed green.
Nothing here has been applied to the source. Each patch is for a person to review and \`git apply\`.

| Locator | Failure | Failed locator | Suggested | Replay |
|---|---|---|---|---|
${rows.join('\n')}

${sections.join('\n\n---\n\n')}
`,
  );
}
