import { anthropic } from "../integrations/anthropic/client";
import { QuoHistorySummary } from "../db/repositories/quoHistorySummaries";

const SYSTEM_PROMPT = `You are building a training reference ("playbook") for an AI agent that
will text customers on behalf of a couch-pickup resale business. You've been given factual
summaries of real past conversations — each already redacted of names, addresses, and phone
numbers.

Produce a markdown playbook with these sections:

## Condition-Question Script
Effective phrasing patterns for asking about smoking household, pets, blemishes, odors, and
stains, based on what actually worked in these conversations.

## Disposition Signals
What condition details and conversation signals tend to correlate with a free pickup, a
mileage fee, or a full charge — inferred from the outcomes and patterns you see. Be explicit
that this is a heuristic starting point, not a rigid rule, since you don't have the business's
actual fee calculator logic.

## Tone & Style Guidelines
How the business communicates effectively — and how to handle negotiation, confusion,
complaints, and frustrated customers specifically, since those are common and must be handled
well, not avoided.

## Example Exchanges
20-30 short representative redacted excerpts, pulled or lightly adapted from the source
material, covering the realistic range: straightforward cases AND the messier ones — declines,
negotiations, complaints, confusion. Label each with what it demonstrates. Do not sanitize this
section down to only clean successes; difficult conversations are the most valuable examples.

## Common Pitfalls
Anything observed in the source conversations that an agent should avoid repeating.

Be concrete and specific. Do not invent conversations that aren't grounded in the provided
summaries. If the data doesn't clearly support a claim, say so rather than guessing.`;

function formatSummariesForPrompt(summaries: QuoHistorySummary[]): string {
  return summaries
    .map((s, i) => {
      const lines = [
        `[#${i + 1}] outcome: ${s.outcome} | difficult: ${s.is_difficult ? "yes" : "no"}`,
        `Summary: ${s.summary}`,
      ];
      if (s.notable_pattern) lines.push(`Pattern: ${s.notable_pattern}`);
      if (s.redacted_excerpt) lines.push(`Excerpt:\n${s.redacted_excerpt}`);
      return lines.join("\n");
    })
    .join("\n---\n");
}

export async function synthesizePlaybook(
  summaries: QuoHistorySummary[],
): Promise<string> {
  const input = formatSummariesForPrompt(summaries);

  const response = await anthropic.messages.create({
    model: "claude-opus-5",
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Here are ${summaries.length} conversation summaries:\n\n${input}`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude did not return a text playbook");
  }
  return textBlock.text;
}
