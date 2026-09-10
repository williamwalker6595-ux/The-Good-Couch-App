import { Router } from "express";
import { z } from "zod";
import { getLeadById, updateLeadStatus } from "../db/repositories/leads";
import {
  getLatestScheduleSlotByLead,
  insertScheduleSlot,
  updateScheduleSlot,
} from "../db/repositories/scheduleSlots";
import { TodoistApiError } from "../integrations/todoist/client";
import { asyncHandler } from "../middleware/asyncHandler";
import { createScheduleTaskForLead } from "../scheduling/scheduleTask";

export const scheduleRouter = Router();

scheduleRouter.get(
  "/leads/:leadId/schedule",
  asyncHandler(async (req, res) => {
    const lead = await getLeadById(req.params.leadId);
    if (!lead) {
      res.status(404).json({ error: "lead not found" });
      return;
    }
    const scheduleSlot = await getLatestScheduleSlotByLead(lead.id);
    res.json(scheduleSlot);
  }),
);

scheduleRouter.post(
  "/leads/:leadId/schedule/create-task",
  asyncHandler(async (req, res) => {
    const lead = await getLeadById(req.params.leadId);
    if (!lead) {
      res.status(404).json({ error: "lead not found" });
      return;
    }

    try {
      const scheduleSlot = await createScheduleTaskForLead(lead.id);
      if (!scheduleSlot) {
        res
          .status(400)
          .json({ error: "TODOIST_API_TOKEN is not configured" });
        return;
      }
      res.status(201).json(scheduleSlot);
    } catch (err) {
      if (err instanceof TodoistApiError) {
        res
          .status(502)
          .json({ error: "todoist task creation failed", detail: err.body });
        return;
      }
      throw err;
    }
  }),
);

const confirmScheduleSchema = z.object({
  pickupDatetime: z.string().datetime(),
});

scheduleRouter.post(
  "/leads/:leadId/schedule",
  asyncHandler(async (req, res) => {
    const lead = await getLeadById(req.params.leadId);
    if (!lead) {
      res.status(404).json({ error: "lead not found" });
      return;
    }

    const parsed = confirmScheduleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const pickupDatetime = new Date(parsed.data.pickupDatetime);
    const existing = await getLatestScheduleSlotByLead(lead.id);

    const scheduleSlot = existing
      ? await updateScheduleSlot(existing.id, {
          pickupDatetime,
          status: "scheduled",
        })
      : await insertScheduleSlot({
          leadId: lead.id,
          pickupDatetime,
          status: "scheduled",
        });

    await updateLeadStatus(lead.id, "scheduled");

    res.json(scheduleSlot);
  }),
);
