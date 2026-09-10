import * as z from "zod/v4";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic } from "../integrations/anthropic/client";
import {
  ConversationMessage,
  listConversationMessagesByLead,
} from "../db/repositories/conversationMessages";
import { Disposition } from "../db/repositories/dispositions";
import {
  insertQuoteResponse,
  QuoteResponse,
} from "../db/repositories/quoteResponses";
import { updateLeadStatus } from "../db/repositories/leads";
import { attemptCreateScheduleTaskForLead } from "../scheduling/scheduleTask";
import { formatTranscript } from "./conditionExtraction";

const quoteResponseSchema = z.object({
  response: z
    .enum(["accepted", "declined", "countered", "unclear"])
    .describe(
      "How the customer responded to the quoted pickup fee. 'unclear' if the latest customer message isn't actually a response to the quote (e.g. a question, a scheduling detail, small talk).",
    ),
  counter_amount: z
    .number()
    .nullable()
    .describe(
      "The dollar amount the customer countered with, only when response is 'countered'. Otherwise null.",
    ),
  confidence: z.number().min(0).max(1),
});

export type QuoteResponseClassificationResult = z.infer<
  typeof quoteResponseSchema
>;

const SYSTEM_PROMPT = `You read a text message conversation between a couch-pickup resale business and a
customer, after the business has already sent the customer a quoted pickup fee (or told
them the pickup is free). Your job is to classify how the customer responded to that
quote based on the most recent customer message(s).

- "accepted": the customer agreed to the quoted fee and pickup.
- "declined": the customer said no, won't proceed, or found another option.
- "countered": the customer proposed a different (lower) amount.
- "unclear": the latest customer message doesn't clearly respond to the quote at all
  (e.g. it's a logistics question, a photo, or unrelated) — use this rather than
  guessing.

Only use what the customer actually said. If uncertain, lower your confidence rather
than forcing a guess.`;

const MIN_CONFIDENCE = 0.55;

export async function classifyQuoteResponse(
  messages: ConversationMessage[],
  quotedAmount: string | null,
): Promise<QuoteResponseClassificationResult> {
  const transcript = formatTranscript(messages);
  const quoteContext = quotedAmount
    ? `The business quoted a pickup fee of $${quotedAmount}.`
    : "The business quoted a free pickup (no fee).";

  const response = await anthropic.messages.parse({
    model: "claude-opus-5",
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `${quoteContext}\n\nConversation transcript:\n${transcript}`,
      },
    ],
    output_config: {
      format: zodOutputFormat(quoteResponseSchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error("Claude did not return parseable quote response data");
  }

  return response.parsed_output;
}

export async function runQuoteResponseClassificationForLead(
  leadId: string,
  disposition: Disposition,
): Promise<QuoteResponse | null> {
  const messages = await listConversationMessagesByLead(leadId);
  const classification = await classifyQuoteResponse(
    messages,
    disposition.quote_amount,
  );

  if (
    classification.response === "unclear" ||
    classification.confidence < MIN_CONFIDENCE
  ) {
    return null;
  }

  const finalAmount =
    classification.response === "countered"
      ? classification.counter_amount
      : disposition.type === "free"
        ? null
        : disposition.quote_amount
          ? Number(disposition.quote_amount)
          : null;

  const quoteResponse = await insertQuoteResponse({
    leadId,
    customerResponse: classification.response,
    finalAmount,
  });

  if (classification.response === "accepted") {
    await updateLeadStatus(leadId, "accepted");
    await attemptCreateScheduleTaskForLead(leadId);
  } else if (classification.response === "declined") {
    await updateLeadStatus(leadId, "declined");
  }
  // "countered" leaves the lead in quote_sent — the owner reviews and decides
  // whether to accept the counter (re-send at the new amount) or hold firm.

  return quoteResponse;
}
