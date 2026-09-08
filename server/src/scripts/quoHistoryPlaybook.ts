// Phase 2 of playbook building: aggregates every stored per-conversation
// summary and asks Claude to synthesize the final curated markdown
// playbook. Run via `npm run history:playbook` after history:summarize
// has completed (or partially completed — it works with whatever
// summaries exist so far).
import { insertAiPlaybook } from "../db/repositories/aiPlaybooks";
import { listAllQuoHistorySummaries } from "../db/repositories/quoHistorySummaries";
import { synthesizePlaybook } from "../ai/playbookSynthesis";

async function main() {
  const summaries = await listAllQuoHistorySummaries();
  if (summaries.length === 0) {
    console.error("No summaries found — run history:summarize first.");
    process.exit(1);
  }

  const totalChars = summaries.reduce(
    (sum, s) =>
      sum +
      s.summary.length +
      s.outcome.length +
      (s.notable_pattern?.length ?? 0) +
      (s.redacted_excerpt?.length ?? 0),
    0,
  );
  console.log(
    `Synthesizing playbook from ${summaries.length} summaries (~${totalChars} characters of input)...`,
  );

  const playbook = await synthesizePlaybook(summaries);

  const saved = await insertAiPlaybook({
    content: playbook,
    sourceConversationCount: summaries.length,
  });

  console.log(`\n=== Playbook generated (id ${saved.id}) ===`);
  console.log(`Source conversations: ${saved.source_conversation_count}`);
  console.log(`Length: ${playbook.length} characters\n`);
  console.log("--- Preview (first 2000 characters) ---");
  console.log(playbook.slice(0, 2000));
  console.log(
    "\nFull content stored in ai_playbooks. Retrieve it via the Postgres Data tab with:\n" +
      `  SELECT content FROM ai_playbooks WHERE id = '${saved.id}';`,
  );
}

main().catch((err) => {
  console.error("Playbook synthesis failed:", err);
  process.exit(1);
});
