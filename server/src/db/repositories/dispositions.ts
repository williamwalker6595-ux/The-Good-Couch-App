import { pool } from "../pool";

export type DispositionType = "free" | "mileage" | "full";
export type DispositionSuggestedBy = "agent" | "human";
export type DispositionStatus = "pending_approval" | "approved" | "rejected";

export interface Disposition {
  id: string;
  lead_id: string;
  type: DispositionType;
  suggested_by: DispositionSuggestedBy;
  confidence: number | null;
  quote_amount: string | null;
  status: DispositionStatus;
  approved_at: Date | null;
  created_at: Date;
}

export async function getLatestDispositionByLead(
  leadId: string,
): Promise<Disposition | null> {
  const result = await pool.query<Disposition>(
    `SELECT * FROM dispositions
     WHERE lead_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [leadId],
  );
  return result.rows[0] ?? null;
}
