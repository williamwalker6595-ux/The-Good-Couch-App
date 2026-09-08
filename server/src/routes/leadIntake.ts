import { Router } from "express";
import { z } from "zod";
import { createLead } from "../db/repositories/leads";
import { asyncHandler } from "../middleware/asyncHandler";

export const leadIntakeRouter = Router();

const leadIntakeSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  address: z.string().trim().min(1).optional(),
  source: z.string().trim().min(1).optional(),
});

leadIntakeRouter.post(
  "/webhooks/lead-intake",
  asyncHandler(async (req, res) => {
    const parsed = leadIntakeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const lead = await createLead({
      name: parsed.data.name,
      phone: parsed.data.phone,
      address: parsed.data.address,
      source: parsed.data.source ?? "website",
    });

    res.status(201).json(lead);
  }),
);
