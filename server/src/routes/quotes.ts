import { Router } from "express";
import { z } from "zod";
import { insertConversationMessage } from "../db/repositories/conversationMessages";
import { getLatestDispositionByLead } from "../db/repositories/dispositions";
import { getLeadById, updateLeadStatus } from "../db/repositories/leads";
import {
  getLatestQuoteResponseByLead,
  insertQuoteResponse,
} from "../db/repositories/quoteResponses";
import { QuoApiError, sendQuoMessage } from "../integrations/quo/client";
import { asyncHandler } from "../middleware/asyncHandler";
import { composeQuoteMessage } from "../quotes/composeQuoteMessage";
import { attemptCreateScheduleTaskForLead } from "../scheduling/scheduleTask";

export const quotesRouter = Router();

const sendQuoteSchema = z.object({
  content: z.string().trim().min(1).max(1600).optional(),
});

quotesRouter.post(
  "/leads/:leadId/quote/send",
  asyncHandler(async (req, res) => {
    const parsed = sendQuoteSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const lead = await getLeadById(req.params.leadId);
    if (!lead) {
      res.status(404).json({ error: "lead not found" });
      return;
    }

    const disposition = await getLatestDispositionByLead(lead.id);
    if (!disposition || disposition.status !== "approved") {
      res
        .status(400)
        .json({ error: "lead has no approved disposition to quote" });
      return;
    }

    const content = parsed.data.content ?? composeQuoteMessage(disposition);

    let quoMessage;
    try {
      quoMessage = await sendQuoMessage({ to: lead.phone, content });
    } catch (err) {
      if (err instanceof QuoApiError) {
        res.status(502).json({ error: "quo send failed", detail: err.body });
        return;
      }
      throw err;
    }

    const savedMessage = await insertConversationMessage({
      leadId: lead.id,
      direction: "out",
      body: content,
      quoMessageId: quoMessage.id,
    });

    const updatedLead = await updateLeadStatus(lead.id, "quote_sent");

    res.status(201).json({ message: savedMessage, lead: updatedLead });
  }),
);

const quoteResponseSchema = z.object({
  customerResponse: z.enum(["accepted", "declined", "countered"]),
  finalAmount: z.number().nullable().optional(),
  discountApplied: z.number().nullable().optional(),
});

quotesRouter.post(
  "/leads/:leadId/quote-response",
  asyncHandler(async (req, res) => {
    const lead = await getLeadById(req.params.leadId);
    if (!lead) {
      res.status(404).json({ error: "lead not found" });
      return;
    }

    const parsed = quoteResponseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const quoteResponse = await insertQuoteResponse({
      leadId: lead.id,
      customerResponse: parsed.data.customerResponse,
      finalAmount: parsed.data.finalAmount,
      discountApplied: parsed.data.discountApplied,
    });

    if (parsed.data.customerResponse === "accepted") {
      await updateLeadStatus(lead.id, "accepted");
      await attemptCreateScheduleTaskForLead(lead.id);
    } else if (parsed.data.customerResponse === "declined") {
      await updateLeadStatus(lead.id, "declined");
    }

    res.status(201).json(quoteResponse);
  }),
);

quotesRouter.get(
  "/leads/:leadId/quote-response",
  asyncHandler(async (req, res) => {
    const lead = await getLeadById(req.params.leadId);
    if (!lead) {
      res.status(404).json({ error: "lead not found" });
      return;
    }
    const quoteResponse = await getLatestQuoteResponseByLead(lead.id);
    res.json(quoteResponse);
  }),
);
