import { env } from "../config/env";
import {
  ConditionAssessment,
  getLatestConditionAssessmentByLead,
} from "../db/repositories/conditionAssessments";
import {
  Disposition,
  getLatestDispositionByLead,
} from "../db/repositories/dispositions";
import { getLeadById, Lead } from "../db/repositories/leads";
import {
  getLatestScheduleSlotByLead,
  insertScheduleSlot,
  ScheduleSlot,
} from "../db/repositories/scheduleSlots";
import { createTodoistTask } from "../integrations/todoist/client";

function composeTaskContent(lead: Lead): string {
  return `Schedule couch pickup — ${lead.name} (${lead.phone})`;
}

function composeTaskDescription(
  lead: Lead,
  disposition: Disposition | null,
  conditionAssessment: ConditionAssessment | null,
): string {
  const lines: string[] = [];
  lines.push(`Phone: ${lead.phone}`);
  lines.push(`Address: ${lead.address ?? "not provided"}`);
  if (disposition) {
    const fee =
      disposition.type === "free"
        ? "Free pickup"
        : `$${disposition.quote_amount ?? "?"} (${disposition.type})`;
    lines.push(`Quote: ${fee} — accepted`);
  }
  if (conditionAssessment) {
    const details = [
      conditionAssessment.smoking_household !== null
        ? `Smoking household: ${conditionAssessment.smoking_household ? "yes" : "no"}`
        : null,
      conditionAssessment.pets !== null
        ? `Pets: ${conditionAssessment.pets ? "yes" : "no"}`
        : null,
      conditionAssessment.blemishes
        ? `Blemishes: ${conditionAssessment.blemishes}`
        : null,
      conditionAssessment.odors ? `Odors: ${conditionAssessment.odors}` : null,
      conditionAssessment.stains
        ? `Stains: ${conditionAssessment.stains}`
        : null,
      conditionAssessment.notes ? `Notes: ${conditionAssessment.notes}` : null,
    ].filter((line): line is string => line !== null);
    lines.push(...details);
  }
  return lines.join("\n");
}

export class NoLeadError extends Error {
  constructor(leadId: string) {
    super(`Lead ${leadId} not found`);
  }
}

export async function createScheduleTaskForLead(
  leadId: string,
): Promise<ScheduleSlot | null> {
  if (!env.todoistApiToken) {
    console.warn(
      "TODOIST_API_TOKEN not set — skipping schedule task creation",
    );
    return null;
  }

  const existing = await getLatestScheduleSlotByLead(leadId);
  if (existing?.todoist_task_id) {
    return existing;
  }

  const lead = await getLeadById(leadId);
  if (!lead) {
    throw new NoLeadError(leadId);
  }

  const [disposition, conditionAssessment] = await Promise.all([
    getLatestDispositionByLead(leadId),
    getLatestConditionAssessmentByLead(leadId),
  ]);

  const task = await createTodoistTask({
    content: composeTaskContent(lead),
    description: composeTaskDescription(lead, disposition, conditionAssessment),
  });

  return insertScheduleSlot({
    leadId,
    todoistTaskId: task.id,
    pickupDatetime: null,
    status: "pending",
  });
}

export async function attemptCreateScheduleTaskForLead(
  leadId: string,
): Promise<void> {
  try {
    await createScheduleTaskForLead(leadId);
  } catch (err) {
    console.error("Failed to create Todoist schedule task for lead", leadId, err);
  }
}
