import { Router } from "express";
import { z } from "zod";
import { listConversationMessagesByLead } from "../db/repositories/conversationMessages";
import { getLatestConditionAssessmentByLead } from "../db/repositories/conditionAssessments";
import { getLatestDispositionByLead } from "../db/repositories/dispositions";
import { getLeadById, LEAD_STATUS_VALUES, listLeads } from "../db/repositories/leads";
import { asyncHandler } from "../middleware/asyncHandler";

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
