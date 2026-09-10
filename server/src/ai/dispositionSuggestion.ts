import * as fs from "fs";
import * as path from "path";
import * as z from "zod/v4";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic } from "../integrations/anthropic/client";
import {
  ConversationMessage,
  listConversationMessagesByLead,
} from "../db/repositories/conversationMessages";
import {
  ConditionAssessment,
  getLatestConditionAssessmentByLead,
} from "../db/repositories/conditionAssessments";
import {
  Disposition,
  DispositionType,
  insertDisposition,
} from "../db/repositories/dispositions";
import { getLeadById, updateLeadStatus } from "../db/repositories/leads";
import {
  calculateQuoteAmount,
  MissingQuoteInputError,
} from "../quotes/calculateQuote";
import { formatTranscript } from "./conditionExtraction";

const PLAYBOOK_PATH = path.join(__dirname, "playbook.md");

let cachedPlaybook: string | null = null;

function loadPlaybook(): string {
  if (cachedPlaybook !== null) {
    return cachedPlaybook;
  }
  try {
    cachedPlaybook = fs.readFileSync(PLAYBOOK_PATH, "utf-8");
  } catch {
    cachedPlaybook = "";
  }
  return cachedPlaybook;
}

const dispositionSuggestionSchema = z.object({
  type: z
    .enum(["free", "mileage", "full"])
    .describe(
      "free = no fee; mileage = fee primarily driven by pickup distance; full = fee driven by item difficulty (recliners, sleepers, patterned fabric, damage, incomplete sectional, etc.), independent of distance",
    ),
  quote_amount: z
    .number()
    .nullable()
    .describe(
      "Fallback fee estimate in whole dollars, or null when type is 'free'. The real amount for 'mileage'/'full' is computed separately from driving distance and seat count when that data is available — this field is only used when that calculation can't run (e.g. no address on file yet). Leave null rather than guessing if you can't name a defensible number.",
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence in this suggestion from 0 to 1"),
  reasoning: z
    .string()
    .describe(
      "Short explanation (1-3 sentences) of which signals from the conversation and playbook drove this suggestion, for a human reviewer to quickly sanity-check",
    ),
});

export type DispositionSuggestionResult = z.infer<
  typeof dispositionSuggestionSchema
>;

function buildSystemPrompt(): string {
  const playbook = loadPlaybook();
  return `You suggest a pricing disposition for a couch-pickup resale business, for a human
owner to review and approve before it is sent to the customer.

A disposition has a type of "free", "mileage", or "full", and (for mileage/full) a
suggested dollar amount. Base your suggestion on the condition assessment and the
conversation transcript, guided by the following playbook distilled from thousands of
real past conversations at this business. The playbook's Disposition Signals section is
explicitly described there as an inferred heuristic, not the business's actual fee
calculator — so when the transcript doesn't clearly support a number, prefer leaving
quote_amount null over fabricating a precise figure, and lower your confidence
accordingly. Never invent facts (distance, floor, damage) that were not stated.

<playbook>
${playbook}
</playbook>`;
}

export async function suggestDisposition(
  messages: ConversationMessage[],
  conditionAssessment: ConditionAssessment | null,
): Promise<DispositionSuggestionResult> {
  const transcript = formatTranscript(messages);
  const assessmentSummary = conditionAssessment
    ? JSON.stringify(
        {
          smoking_household: conditionAssessment.smoking_household,
          pets: conditionAssessment.pets,
          blemishes: conditionAssessment.blemishes,
          odors: conditionAssessment.odors,
          stains: conditionAssessment.stains,
          notes: conditionAssessment.notes,
        },
        null,
        2,
      )
    : "No structured condition assessment available yet.";

  const userContent = `Condition assessment:\n${assessmentSummary}\n\nConversation transcript:\n${transcript}`;

  const response = await anthropic.messages.parse({
    model: "claude-opus-5",
    max_tokens: 1024,
    // The system prompt (including the ~45KB playbook) is identical on
    // every call for every lead — cache it so only occasional calls pay
    // full price for it. A 1h TTL (vs. the 5m default) trades a slightly
    // pricier cache write for a much higher hit rate given how sporadic
    // inbound texts are, and this same cached prefix is shared across
    // every lead's calls, not just repeat calls on the same one.
    system: [
      {
        type: "text",
        text: buildSystemPrompt(),
        cache_control: { type: "ephemeral", ttl: "1h" },
      },
    ],
    messages: [{ role: "user", content: userContent }],
    output_config: {
      format: zodOutputFormat(dispositionSuggestionSchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error("Claude did not return parseable disposition data");
  }

  console.log("Disposition suggestion cache usage", {
    cacheRead: response.usage.cache_read_input_tokens,
    cacheWrite: response.usage.cache_creation_input_tokens,
    uncached: response.usage.input_tokens,
  });

  return response.parsed_output;
}

export class NoConversationError extends Error {
  constructor(leadId: string) {
    super(`Lead ${leadId} has no conversation messages to suggest a disposition from`);
  }
}

export async function runDispositionSuggestionForLead(
  leadId: string,
): Promise<Disposition> {
  const messages = await listConversationMessagesByLead(leadId);
  if (messages.length === 0) {
    throw new NoConversationError(leadId);
  }

  const conditionAssessment = await getLatestConditionAssessmentByLead(leadId);

  const suggestion = await suggestDisposition(messages, conditionAssessment);

  let quoteAmount = suggestion.quote_amount;
  let reasoning = suggestion.reasoning;
  let confidence = suggestion.confidence;

  if (suggestion.type === "mileage" || suggestion.type === "full") {
    const lead = await getLeadById(leadId);
    if (!lead?.address) {
      reasoning = `${reasoning} (No pickup address on file yet, so this is a rough AI estimate — recalculate once the address is known.)`;
      confidence = Math.min(confidence, 0.4);
    } else {
      try {
        const calculation = await calculateQuoteAmount({
          type: suggestion.type,
          address: lead.address,
          seatCount: conditionAssessment?.seat_count ?? null,
        });
        quoteAmount = calculation.amount;
        reasoning = `${reasoning} Calculated quote: ${calculation.explanation}`;
      } catch (err) {
        const detail =
          err instanceof MissingQuoteInputError
            ? "missing seat/section count"
            : "distance lookup failed";
        console.error("Quote calculation failed for lead", leadId, err);
        reasoning = `${reasoning} (Could not calculate an exact quote — ${detail}; this is a rough AI estimate, please verify.)`;
        confidence = Math.min(confidence, 0.4);
      }
    }
  }

  const disposition = await insertDisposition({
    leadId,
    type: suggestion.type as DispositionType,
    suggestedBy: "agent",
    confidence,
    quoteAmount,
    reasoning,
  });

  await updateLeadStatus(leadId, "awaiting_disposition");

  return disposition;
}
