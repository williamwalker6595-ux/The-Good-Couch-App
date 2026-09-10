import { Router } from "express";
import { runConditionExtractionForLead } from "../ai/conditionExtraction";
import { runDispositionSuggestionForLead } from "../ai/dispositionSuggestion";
import { runQuoteResponseClassificationForLead } from "../ai/quoteResponseClassification";
import { env } from "../config/env";
import {
  findConversationMessageByQuoId,
  insertConversationMessage,
} from "../db/repositories/conversationMessages";
import { getLatestDispositionByLead } from "../db/repositories/dispositions";
import { findOrCreateLeadByPhone } from "../db/repositories/leads";
import { verifyQuoWebhookSignature } from "../integrations/quo/signature";
import { QuoWebhookEvent, quoMessageText } from "../integrations/quo/types";
import { asyncHandler } from "../middleware/asyncHandler";

export const quoWebhookRouter = Router();

function normalizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

// Quo's real "message.received" webhook payload doesn't match the array
// shape the (best-guess, doc-derived) QuoMessage type declares for `to` —
// in practice it's been observed as something other than a string[].
// Accept a string, an array, or anything unexpected without throwing.
function extractToNumbers(to: unknown): string[] {
  if (Array.isArray(to)) {
    return to.filter((t): t is string => typeof t === "string");
  }
  if (typeof to === "string") {
    return [to];
  }
  return [];
}

quoWebhookRouter.post(
  "/webhooks/quo",
  asyncHandler(async (req, res) => {
    if (!req.rawBody) {
      res.status(400).json({ error: "missing body" });
      return;
    }

    if (env.quoWebhookSigningKey) {
      const valid = verifyQuoWebhookSignature(
        {
          "webhook-id": req.header("webhook-id"),
          "webhook-timestamp": req.header("webhook-timestamp"),
          "webhook-signature": req.header("webhook-signature"),
          "openphone-signature": req.header("openphone-signature"),
        },
        req.rawBody,
        env.quoWebhookSigningKey,
      );
      if (!valid) {
        console.warn("Quo webhook signature check failed", {
          headers: {
            "webhook-id": req.header("webhook-id"),
            "webhook-timestamp": req.header("webhook-timestamp"),
            "webhook-signature": req.header("webhook-signature"),
            "openphone-signature": req.header("openphone-signature"),
          },
          allHeaderNames: Object.keys(req.headers),
        });
        res.status(401).json({ error: "invalid signature" });
        return;
      }
    } else {
      console.warn(
        "QUO_WEBHOOK_SIGNING_KEY not set — accepting webhook without signature verification",
      );
    }

    const event = req.body as QuoWebhookEvent;

    if (event.type !== "message.received") {
      res.status(200).json({ ignored: event.type });
      return;
    }

    const message = event.data.object;

    if (env.quoFromNumber) {
      const target = normalizePhoneNumber(env.quoFromNumber);
      const toNumbers = extractToNumbers(message.to);
      const matchesTarget = toNumbers.some(
        (to) => normalizePhoneNumber(to) === target,
      );
      if (!matchesTarget) {
        console.warn("Quo webhook message.to did not match target number", {
          to: message.to,
          toType: typeof message.to,
          target,
        });
        res.status(200).json({ ignored: "wrong number", to: message.to });
        return;
      }
    }

    const existing = await findConversationMessageByQuoId(message.id);
    if (existing) {
      res.status(200).json({ deduped: true });
      return;
    }

    const lead = await findOrCreateLeadByPhone(message.from);

    await insertConversationMessage({
      leadId: lead.id,
      direction: "in",
      body: quoMessageText(message),
      mediaUrls: (message.media ?? []).map((m) => m.url),
      quoMessageId: message.id,
    });

    res.status(200).json({ ok: true });

    if (env.anthropicApiKey) {
      if (lead.status === "quote_sent") {
        getLatestDispositionByLead(lead.id)
          .then((disposition) => {
            if (!disposition || disposition.status !== "approved") return;
            return runQuoteResponseClassificationForLead(lead.id, disposition);
          })
          .catch((err) => {
            console.error(
              "Quote response classification failed for lead",
              lead.id,
              err,
            );
          });
      } else {
        runConditionExtractionForLead(lead.id)
          .catch((err) => {
            console.error("Condition extraction failed for lead", lead.id, err);
          })
          .then(() => runDispositionSuggestionForLead(lead.id))
          .catch((err) => {
            console.error(
              "Disposition suggestion failed for lead",
              lead.id,
              err,
            );
          });
      }
    }
  }),
);
