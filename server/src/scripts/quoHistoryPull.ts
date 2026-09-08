// Pulls the most recent 2000 Quo conversations on TGC - Pickup Phone,
// fetches each conversation's full message history, drops true dead ends
// (no reply, or only a "wrong number"/"stop"-style reply), and stores the
// rest in quo_history_conversations for the AI playbook-building pass.
//
// Idempotent/resumable: conversations already stored are skipped, so a
// prior partial run (interruption, rate limit exhaustion) can safely be
// re-run to pick up where it left off.
//
// Run via `npm run history:pull` — needs real internet access to
// api.quo.com (e.g. Railway's Console).
import { env } from "../config/env";
import { isSubstantiveConversation } from "../ai/quoHistoryFilter";
import {
  countQuoHistoryConversations,
  hasQuoHistoryConversation,
  insertQuoHistoryConversation,
} from "../db/repositories/quoHistoryConversations";
import {
  iterateAllConversations,
  iterateAllMessages,
  QuoConversation,
} from "../integrations/quo/historyClient";

const TGC_PICKUP_PHONE = env.quoFromNumber;
const TARGET_COUNT = 2000;
const CONVERSATION_PACING_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function otherParticipant(conversation: QuoConversation): string {
  return (
    conversation.participants.find((p) => p !== TGC_PICKUP_PHONE) ??
    conversation.participants[0]
  );
}

async function main() {
  console.log(`Listing conversations for ${TGC_PICKUP_PHONE}...`);
  const all: QuoConversation[] = [];
  for await (const conversation of iterateAllConversations({
    phoneNumbers: [TGC_PICKUP_PHONE],
  })) {
    all.push(conversation);
  }
  console.log(`Found ${all.length} total conversations.`);

  all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const target = all.slice(0, TARGET_COUNT);
  console.log(`Processing the most recent ${target.length} conversations.`);

  let processed = 0;
  let skippedAlreadyStored = 0;
  let kept = 0;
  let droppedDeadEnd = 0;
  let errors = 0;

  for (const conversation of target) {
    processed += 1;

    if (await hasQuoHistoryConversation(conversation.id)) {
      skippedAlreadyStored += 1;
      continue;
    }

    const participant = otherParticipant(conversation);

    try {
      const messages = [];
      for await (const message of iterateAllMessages({
        phoneNumberId: conversation.phoneNumberId,
        participants: [participant],
      })) {
        messages.push(message);
      }

      if (isSubstantiveConversation(messages)) {
        await insertQuoHistoryConversation({
          id: conversation.id,
          phoneNumberId: conversation.phoneNumberId,
          participantPhone: participant,
          messages,
          quoCreatedAt: conversation.createdAt,
        });
        kept += 1;
      } else {
        droppedDeadEnd += 1;
      }
    } catch (err) {
      errors += 1;
      console.error(`Failed on conversation ${conversation.id}:`, err);
    }

    if (processed % 50 === 0) {
      console.log(
        `...processed ${processed}/${target.length} (kept ${kept}, dropped ${droppedDeadEnd}, skipped ${skippedAlreadyStored}, errors ${errors})`,
      );
    }

    await sleep(CONVERSATION_PACING_MS);
  }

  const totalStored = await countQuoHistoryConversations();

  console.log("\n=== Quo history pull summary ===");
  console.log(`Processed this run: ${processed}`);
  console.log(`Already stored (skipped): ${skippedAlreadyStored}`);
  console.log(`Kept (substantive): ${kept}`);
  console.log(`Dropped (dead end): ${droppedDeadEnd}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total stored in quo_history_conversations: ${totalStored}`);
}

main().catch((err) => {
  console.error("Quo history pull failed:", err);
  process.exit(1);
});
