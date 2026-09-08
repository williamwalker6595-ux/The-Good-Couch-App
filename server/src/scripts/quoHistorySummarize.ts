// Phase 1 of playbook building: runs a cheap per-conversation extraction
// (Haiku, structured output) over every stored history conversation that
// doesn't have a summary yet. Idempotent/resumable — already-summarized
// conversations are excluded by the query itself.
//
// Run via `npm run history:summarize` (needs ANTHROPIC_API_KEY and real
// internet access — e.g. Railway's Console).
import Anthropic from "@anthropic-ai/sdk";
import { summarizeHistoryConversation } from "../ai/historySummarize";
import { insertQuoHistorySummary } from "../db/repositories/quoHistorySummaries";
import { listConversationsWithoutSummary } from "../db/repositories/quoHistoryConversations";

const REQUEST_PACING_MS = 150;
const MAX_RETRIES = 5;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function summarizeWithRetry(
  messages: Parameters<typeof summarizeHistoryConversation>[0],
) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await summarizeHistoryConversation(messages);
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError && attempt < MAX_RETRIES) {
        const delay = Math.min(30_000, 1000 * 2 ** attempt);
        console.log(
          `Rate limited, retrying in ${Math.round(delay / 1000)}s (attempt ${attempt + 1}/${MAX_RETRIES})`,
        );
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw new Error("unreachable");
}

async function main() {
  const pending = await listConversationsWithoutSummary();
  console.log(`${pending.length} conversations need summarization.`);

  let processed = 0;
  let errors = 0;

  for (const conversation of pending) {
    processed += 1;
    try {
      const summary = await summarizeWithRetry(conversation.messages);
      await insertQuoHistorySummary({
        conversationId: conversation.id,
        summary: summary.summary,
        outcome: summary.outcome,
        notablePattern: summary.notable_pattern,
        isDifficult: summary.is_difficult,
        redactedExcerpt: summary.redacted_excerpt,
      });
    } catch (err) {
      errors += 1;
      console.error(`Failed on conversation ${conversation.id}:`, err);
    }

    if (processed % 50 === 0) {
      console.log(`...summarized ${processed}/${pending.length} (errors ${errors})`);
    }

    await sleep(REQUEST_PACING_MS);
  }

  console.log("\n=== Summarization pass complete ===");
  console.log(`Processed: ${processed}`);
  console.log(`Errors: ${errors}`);
}

main().catch((err) => {
  console.error("Quo history summarization failed:", err);
  process.exit(1);
});
