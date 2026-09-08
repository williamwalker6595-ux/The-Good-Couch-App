import * as z from "zod/v4";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic } from "../integrations/anthropic/client";
import {
  ConversationMessage,
  listConversationMessagesByLead,
} from "../db/repositories/conversationMessages";
import {
  ConditionAssessment,
  insertConditionAssessment,
} from "../db/repositories/conditionAssessments";

const conditionExtractionSchema = z.object({
  smoking_household: z
    .boolean()
    .nullable()
    .describe("Whether anyone in the household smokes, if mentioned"),
  pets: z
    .boolean()
    .nullable()
    .describe("Whether there are pets in the household, if mentioned"),
  blemishes: z
    .string()
    .nullable()
    .describe("Short description of any blemishes/wear mentioned, or null"),
  odors: z
    .string()
    .nullable()
    .describe("Short description of any odors mentioned, or null"),
  stains: z
    .string()
    .nullable()
    .describe("Short description of any stains mentioned, or null"),
  notes: z
    .string()
    .nullable()
    .describe("Any other relevant condition notes, or null"),
});

export type ConditionExtractionResult = z.infer<
  typeof conditionExtractionSchema
>;

const SYSTEM_PROMPT = `You extract structured couch-condition information from a text message
conversation between a couch-pickup resale business and a customer selling their couch.

Only report information the customer has actually stated. If something isn't mentioned,
use null for that field — never guess or infer beyond what's explicitly said. Keep string
fields short and factual (a phrase, not a paragraph).`;

function formatTranscript(messages: ConversationMessage[]): string {
  return messages
    .map((message) => {
      const speaker = message.direction === "in" ? "Customer" : "Business";
      const body = message.body ?? "(no text)";
      const media = message.media_urls.length
        ? ` [${message.media_urls.length} photo(s) attached]`
        : "";
      return `${speaker}: ${body}${media}`;
    })
    .join("\n");
}

export async function extractConditionAssessment(
  messages: ConversationMessage[],
): Promise<ConditionExtractionResult> {
  const transcript = formatTranscript(messages);

  const response = await anthropic.messages.parse({
    model: "claude-opus-5",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: transcript }],
    output_config: {
      format: zodOutputFormat(conditionExtractionSchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error("Claude did not return parseable condition data");
  }

  return response.parsed_output;
}

export class NoConversationError extends Error {
  constructor(leadId: string) {
    super(`Lead ${leadId} has no conversation messages to extract from`);
  }
}

export async function runConditionExtractionForLead(
  leadId: string,
): Promise<ConditionAssessment> {
  const messages = await listConversationMessagesByLead(leadId);
  if (messages.length === 0) {
    throw new NoConversationError(leadId);
  }

  const extracted = await extractConditionAssessment(messages);

  const photoRefs = Array.from(
    new Set(
      messages
        .filter((message) => message.direction === "in")
        .flatMap((message) => message.media_urls),
    ),
  );

  return insertConditionAssessment({
    leadId,
    smokingHousehold: extracted.smoking_household,
    pets: extracted.pets,
    blemishes: extracted.blemishes,
    odors: extracted.odors,
    stains: extracted.stains,
    notes: extracted.notes,
    photoRefs,
  });
}
