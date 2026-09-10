import { pool } from "../pool";

export interface ScheduleSlot {
  id: string;
  lead_id: string;
  todoist_task_id: string | null;
  pickup_datetime: Date | null;
  status: string;
  created_at: Date;
}

export async function insertScheduleSlot(input: {
  leadId: string;
  todoistTaskId?: string | null;
  pickupDatetime?: Date | null;
  status: string;
}): Promise<ScheduleSlot> {
  const result = await pool.query<ScheduleSlot>(
    `INSERT INTO schedule_slots (lead_id, todoist_task_id, pickup_datetime, status)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [
      input.leadId,
      input.todoistTaskId ?? null,
      input.pickupDatetime ?? null,
      input.status,
    ],
  );
  return result.rows[0];
}

export async function getLatestScheduleSlotByLead(
  leadId: string,
): Promise<ScheduleSlot | null> {
  const result = await pool.query<ScheduleSlot>(
    `SELECT * FROM schedule_slots
     WHERE lead_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [leadId],
  );
  return result.rows[0] ?? null;
}

export async function updateScheduleSlot(
  id: string,
  input: {
    pickupDatetime?: Date | null;
    status?: string;
    todoistTaskId?: string | null;
  },
): Promise<ScheduleSlot | null> {
  const result = await pool.query<ScheduleSlot>(
    `UPDATE schedule_slots
     SET pickup_datetime = CASE WHEN $2 THEN $3 ELSE pickup_datetime END,
         status = COALESCE($4, status),
         todoist_task_id = COALESCE($5, todoist_task_id)
     WHERE id = $1
     RETURNING *`,
    [
      id,
      input.pickupDatetime !== undefined,
      input.pickupDatetime ?? null,
      input.status ?? null,
      input.todoistTaskId ?? null,
    ],
  );
  return result.rows[0] ?? null;
}
