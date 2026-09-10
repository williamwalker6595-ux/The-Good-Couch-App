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
import { getLeadById, updateLeadAddress } from "../db/repositories/leads";
import { estimateSeatCountFromPhotos } from "./seatCountVision";

const MIN_VISION_SEAT_COUNT_CONFIDENCE = 0.5;

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
  pickup_address: z
    .string()
    .nullable()
    .describe(
      "The customer's full pickup address (street, city, state), only if they've stated one clearly enough to geocode. Null if not mentioned or incomplete.",
    ),
  seat_count: z
    .number()
    .int()
    .nullable()
    .describe(
      "Total number of seats or ~30-inch sections on the item (e.g. a 3-seat couch is 3; a sectional with a chaise plus two armrest pieces is however many such sections were described). Null if not enough detail was given to count.",
    ),
});

export type ConditionExtractionResult = z.infer<
  typeof conditionExtractionSchema
>;

const SYSTEM_PROMPT = `You extract structured couch-condition information from a text message
conversation between a couch-pickup resale business and a customer selling their couch.

Only report information the customer has actually stated. If something isn't mentioned,
use null for that field — never guess or infer beyond what's explicitly said. Keep string
fields short and factual (a phrase, not a paragraph).

pickup_address and seat_count feed a pickup-fee calculator, so precision matters more than
completeness there: only fill them in when the customer's own words support an exact value.
A partial address ("west side of town") or a vague item description ("pretty big sectional")
should stay null rather than being guessed at.`;

export function formatTranscript(messages: ConversationMessage[]): string {
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

  // Prefer a vision-based seat count from the actual photos over the
  // customer's own words, when confident — "how many people could sit
  // side by side" is much more reliably judged from a photo than from
  // however the customer happened to describe it in text.
  let seatCount = extracted.seat_count;
  if (photoRefs.length > 0) {
    try {
      const visionResult = await estimateSeatCountFromPhotos(photoRefs);
      if (
        visionResult?.seat_count !== null &&
        visionResult !== null &&
        visionResult.confidence >= MIN_VISION_SEAT_COUNT_CONFIDENCE
      ) {
        seatCount = visionResult.seat_count;
      }
    } catch (err) {
      console.error("Seat count vision failed for lead", leadId, err);
    }
  }

  const assessment = await insertConditionAssessment({
    leadId,
    smokingHousehold: extracted.smoking_household,
    pets: extracted.pets,
    blemishes: extracted.blemishes,
    odors: extracted.odors,
    stains: extracted.stains,
    notes: extracted.notes,
    seatCount,
    photoRefs,
  });

  if (extracted.pickup_address) {
    const lead = await getLeadById(leadId);
    if (lead && !lead.address) {
      await updateLeadAddress(leadId, extracted.pickup_address);
    }
  }

  return assessment;
}
