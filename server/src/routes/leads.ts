import { Router } from "express";
import { z } from "zod";
import {
  NoConversationError,
  runConditionExtractionForLead,
} from "../ai/conditionExtraction";
import {
  NoConversationError as NoConversationForDispositionError,
  runDispositionSuggestionForLead,
} from "../ai/dispositionSuggestion";
import { listConversationMessagesByLead } from "../db/repositories/conversationMessages";
import { getLatestConditionAssessmentByLead } from "../db/repositories/conditionAssessments";
import {
  DISPOSITION_TYPE_VALUES,
  getDispositionById,
  getLatestDispositionByLead,
  insertDisposition,
  updateDispositionDecision,
} from "../db/repositories/dispositions";
import {
  getLeadById,
  LEAD_STATUS_VALUES,
  listLeads,
  updateLeadStatus,
} from "../db/repositories/leads";
import { asyncHandler } from "../middleware/asyncHandler";
import { calculateQuoteOptions } from "../quotes/calculateQuote";

export const leadsRouter = Router();

const listLeadsQuerySchema = z.object({
  status: z.enum(LEAD_STATUS_VALUES).optional(),
});

leadsRouter.get(
  "/leads",
  asyncHandler(async (req, res) => {
    const parsed = listLeadsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const leads = await listLeads({ status: parsed.data.status });
    res.json(leads);
  }),
);

leadsRouter.get(
  "/leads/:leadId",
  asyncHandler(async (req, res) => {
    const lead = await getLeadById(req.params.leadId);
    if (!lead) {
      res.status(404).json({ error: "lead not found" });
      return;
    }
    res.json(lead);
  }),
);

leadsRouter.get(
  "/leads/:leadId/messages",
  asyncHandler(async (req, res) => {
    const lead = await getLeadById(req.params.leadId);
    if (!lead) {
      res.status(404).json({ error: "lead not found" });
      return;
    }
    const messages = await listConversationMessagesByLead(req.params.leadId);
    res.json(messages);
  }),
);

leadsRouter.get(
  "/leads/:leadId/condition-assessment",
  asyncHandler(async (req, res) => {
    const lead = await getLeadById(req.params.leadId);
    if (!lead) {
      res.status(404).json({ error: "lead not found" });
      return;
    }
    const assessment = await getLatestConditionAssessmentByLead(
      req.params.leadId,
    );
    res.json(assessment);
  }),
);

leadsRouter.post(
  "/leads/:leadId/condition-assessment/extract",
  asyncHandler(async (req, res) => {
    const lead = await getLeadById(req.params.leadId);
    if (!lead) {
      res.status(404).json({ error: "lead not found" });
      return;
    }

    try {
      const assessment = await runConditionExtractionForLead(
        req.params.leadId,
      );
      res.status(201).json(assessment);
    } catch (err) {
      if (err instanceof NoConversationError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
  }),
);

leadsRouter.get(
  "/leads/:leadId/disposition",
  asyncHandler(async (req, res) => {
    const lead = await getLeadById(req.params.leadId);
    if (!lead) {
      res.status(404).json({ error: "lead not found" });
      return;
    }
    const disposition = await getLatestDispositionByLead(req.params.leadId);
    res.json(disposition);
  }),
);

leadsRouter.post(
  "/leads/:leadId/disposition/suggest",
  asyncHandler(async (req, res) => {
    const lead = await getLeadById(req.params.leadId);
    if (!lead) {
      res.status(404).json({ error: "lead not found" });
      return;
    }

    try {
      const disposition = await runDispositionSuggestionForLead(
        req.params.leadId,
      );
      res.status(201).json(disposition);
    } catch (err) {
      if (err instanceof NoConversationForDispositionError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
  }),
);

leadsRouter.get(
  "/leads/:leadId/disposition/quote-options",
  asyncHandler(async (req, res) => {
    const lead = await getLeadById(req.params.leadId);
    if (!lead) {
      res.status(404).json({ error: "lead not found" });
      return;
    }
    const conditionAssessment = await getLatestConditionAssessmentByLead(
      lead.id,
    );
    const options = await calculateQuoteOptions({
      address: lead.address,
      seatCount: conditionAssessment?.seat_count ?? null,
    });
    res.json(options);
  }),
);

const quickApproveSchema = z.object({
  type: z.enum(DISPOSITION_TYPE_VALUES),
});

leadsRouter.post(
  "/leads/:leadId/disposition/quick-approve",
  asyncHandler(async (req, res) => {
    const lead = await getLeadById(req.params.leadId);
    if (!lead) {
      res.status(404).json({ error: "lead not found" });
      return;
    }

    const parsed = quickApproveSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const conditionAssessment = await getLatestConditionAssessmentByLead(
      lead.id,
    );
    const options = await calculateQuoteOptions({
      address: lead.address,
      seatCount: conditionAssessment?.seat_count ?? null,
    });
    const option = options[parsed.data.type];
    if (option.amount === null) {
      res.status(400).json({
        error: option.blockedReason ?? "cannot calculate this quote yet",
      });
      return;
    }

    const disposition = await insertDisposition({
      leadId: lead.id,
      type: parsed.data.type,
      suggestedBy: "human",
      confidence: 1,
      quoteAmount: option.amount,
      reasoning: option.explanation,
    });
    const approved = await updateDispositionDecision(disposition.id, {
      status: "approved",
    });
    await updateLeadStatus(lead.id, "disposition_approved");

    res.status(201).json(approved);
  }),
);

const dispositionDecisionSchema = z.object({
  type: z.enum(DISPOSITION_TYPE_VALUES).optional(),
  quoteAmount: z.number().nullable().optional(),
});

leadsRouter.post(
  "/leads/:leadId/disposition/:dispositionId/approve",
  asyncHandler(async (req, res) => {
    const lead = await getLeadById(req.params.leadId);
    if (!lead) {
      res.status(404).json({ error: "lead not found" });
      return;
    }

    const parsed = dispositionDecisionSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const existing = await getDispositionById(req.params.dispositionId);
    if (!existing || existing.lead_id !== lead.id) {
      res.status(404).json({ error: "disposition not found" });
      return;
    }

    const disposition = await updateDispositionDecision(
      req.params.dispositionId,
      { status: "approved", ...parsed.data },
    );
    await updateLeadStatus(lead.id, "disposition_approved");
    res.json(disposition);
  }),
);

leadsRouter.post(
  "/leads/:leadId/disposition/:dispositionId/reject",
  asyncHandler(async (req, res) => {
    const lead = await getLeadById(req.params.leadId);
    if (!lead) {
      res.status(404).json({ error: "lead not found" });
      return;
    }

    const existing = await getDispositionById(req.params.dispositionId);
    if (!existing || existing.lead_id !== lead.id) {
      res.status(404).json({ error: "disposition not found" });
      return;
    }

    const disposition = await updateDispositionDecision(
      req.params.dispositionId,
      { status: "rejected" },
    );
    res.json(disposition);
  }),
);
