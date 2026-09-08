import * as z from "zod/v4";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic } from "../integrations/anthropic/client";
import { QuoHistoryMessage } from "../integrations/quo/historyClient";

const summarySchema = z.object({
  summary: z
    .string()
    .describe("1-2 sentence factual summary of what happened in this conversation"),
  outcome: z
    .string()
    .describe(
      "Short free-text label for how the conversation ended, e.g. 'scheduled pickup', " +
        "'declined - price too low', 'customer went silent', 'negotiated lower fee', " +
        "'unresolved', 'rescheduled', 'complaint about no-show'",
    ),
  notable_pattern: z
    .string()
    .nullable()
    .describe(
      "Any noteworthy phrasing, negotiation tactic, objection-handling approach, or tone " +
        "worth remembering for training a similar agent, or null if nothing stands out",
    ),
  is_difficult: z
    .boolean()
    .describe(
      "True if this conversation involved negotiation, confusion, frustration, a complaint, " +
        "or any non-trivial edge case — not just a smooth straightforward exchange",
    ),
  redacted_excerpt: z
    .string()
    .nullable()
    .describe(
      "A short representative excerpt (a few lines of dialogue) from the conversation that " +
        "illustrates its most useful pattern, with all names, exact addresses, and phone " +
        "numbers replaced with placeholders like [name]/[address]/[phone]. Null if the " +
        "conversation has nothing worth excerpting.",
    ),
});

export type HistorySummary = z.infer<typeof summarySchema>;

const SYSTEM_PROMPT = `You analyze a real text-message conversation between a couch-pickup
resale business and a customer selling their couch. You're helping build a training reference
("playbook") for an AI agent that will handle these conversations in the future.

Extract a factual summary, how the conversation concluded, any notable tactic or phrasing
worth remembering, whether this was a difficult/messy conversation (negotiation, confusion,
frustration, complaints — these are valuable examples, not failures), and a short redacted
excerpt illustrating the most useful pattern. Redact all names, exact addresses, and phone
numbers from the excerpt using placeholders. Be factual — don't editorialize or invent details
not present in the conversation.`;

function formatTranscript(messages: QuoHistoryMessage[]): string {
  return messages
    .map((message) => {
      const speaker = message.direction === "incoming" ? "Customer" : "Business";
      const body = message.text ?? message.body ?? "(no text)";
      const media = message.media?.length
        ? ` [${message.media.length} photo(s) attached]`
        : "";
      return `${speaker}: ${body}${media}`;
    })
    .join("\n");
}

export async function summarizeHistoryConversation(
  messages: QuoHistoryMessage[],
): Promise<HistorySummary> {
  const transcript = formatTranscript(messages);

  const response = await anthropic.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: transcript }],
    output_config: {
      format: zodOutputFormat(summarySchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error("Claude did not return parseable summary data");
  }

  return response.parsed_output;
}
