import { Router } from "express";
import { z } from "zod";
import { insertConversationMessage } from "../db/repositories/conversationMessages";
import { getLeadById } from "../db/repositories/leads";
import { QuoApiError, sendQuoMessage } from "../integrations/quo/client";
import { asyncHandler } from "../middleware/asyncHandler";

export const messagesRouter = Router();

const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(1600),
});

messagesRouter.post(
  "/leads/:leadId/messages",
  asyncHandler(async (req, res) => {
    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const lead = await getLeadById(req.params.leadId);
    if (!lead) {
      res.status(404).json({ error: "lead not found" });
      return;
    }

    let quoMessage;
    try {
      quoMessage = await sendQuoMessage({
        to: lead.phone,
        content: parsed.data.content,
      });
    } catch (err) {
      if (err instanceof QuoApiError) {
        res.status(502).json({ error: "quo send failed", detail: err.body });
        return;
      }
      throw err;
    }

    const saved = await insertConversationMessage({
      leadId: lead.id,
      direction: "out",
      body: parsed.data.content,
      quoMessageId: quoMessage.id,
    });

    res.status(201).json(saved);
  }),
);
