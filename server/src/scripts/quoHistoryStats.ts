// One-off reconnaissance script: reports how much Quo conversation history
// exists before committing to a full pull + AI analysis pass. Run via
// `node dist/scripts/quoHistoryStats.js` (e.g. from Railway's Console —
// this needs real internet access to api.quo.com, which local/sandboxed
// dev environments may not have).
import { iterateAllConversations } from "../integrations/quo/historyClient";

async function main() {
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  let total = 0;
  let minCreatedAt: string | null = null;
  let maxCreatedAt: string | null = null;
  const byPhoneNumberId = new Map<string, number>();

  for await (const conversation of iterateAllConversations({
    createdAfter: twoYearsAgo.toISOString(),
  })) {
    total += 1;
    if (!minCreatedAt || conversation.createdAt < minCreatedAt) {
      minCreatedAt = conversation.createdAt;
    }
    if (!maxCreatedAt || conversation.createdAt > maxCreatedAt) {
      maxCreatedAt = conversation.createdAt;
    }
    byPhoneNumberId.set(
      conversation.phoneNumberId,
      (byPhoneNumberId.get(conversation.phoneNumberId) ?? 0) + 1,
    );

    if (total % 100 === 0) {
      console.log(`...counted ${total} conversations so far`);
    }
  }

  console.log("\n=== Quo conversation history summary (last 2 years) ===");
  console.log(`Total conversations: ${total}`);
  console.log(`Date range: ${minCreatedAt ?? "n/a"} to ${maxCreatedAt ?? "n/a"}`);
  console.log("By phone number ID:");
  for (const [phoneNumberId, count] of byPhoneNumberId) {
    console.log(`  ${phoneNumberId}: ${count}`);
  }
}

main().catch((err) => {
  console.error("Failed to gather Quo history stats:", err);
  process.exit(1);
});
