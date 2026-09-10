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
import { updateLeadStatus } from "../db/repositories/leads";
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
      "Suggested fee in whole dollars, or null when type is 'free'. Leave null if there isn't enough information in the conversation to name a specific number (e.g. distance was never mentioned) — do not guess a figure.",
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
    system: buildSystemPrompt(),
    messages: [{ role: "user", content: userContent }],
    output_config: {
      format: zodOutputFormat(dispositionSuggestionSchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error("Claude did not return parseable disposition data");
  }

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

  const disposition = await insertDisposition({
    leadId,
    type: suggestion.type as DispositionType,
    suggestedBy: "agent",
    confidence: suggestion.confidence,
    quoteAmount: suggestion.quote_amount,
    reasoning: suggestion.reasoning,
  });

  await updateLeadStatus(leadId, "awaiting_disposition");

  return disposition;
}
