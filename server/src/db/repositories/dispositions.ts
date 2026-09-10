import { pool } from "../pool";

export const DISPOSITION_TYPE_VALUES = ["free", "mileage", "full"] as const;
export type DispositionType = (typeof DISPOSITION_TYPE_VALUES)[number];
export type DispositionSuggestedBy = "agent" | "human";
export type DispositionStatus = "pending_approval" | "approved" | "rejected";

export interface Disposition {
  id: string;
  lead_id: string;
  type: DispositionType;
  suggested_by: DispositionSuggestedBy;
  confidence: number | null;
  quote_amount: string | null;
  reasoning: string | null;
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

export async function getDispositionById(
  id: string,
): Promise<Disposition | null> {
  const result = await pool.query<Disposition>(
    `SELECT * FROM dispositions WHERE id = $1 LIMIT 1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function insertDisposition(input: {
  leadId: string;
  type: DispositionType;
  suggestedBy: DispositionSuggestedBy;
  confidence: number | null;
  quoteAmount: number | null;
  reasoning: string | null;
}): Promise<Disposition> {
  const result = await pool.query<Disposition>(
    `INSERT INTO dispositions
       (lead_id, type, suggested_by, confidence, quote_amount, reasoning)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.leadId,
      input.type,
      input.suggestedBy,
      input.confidence,
      input.quoteAmount,
      input.reasoning,
    ],
  );
  return result.rows[0];
}

export async function updateDispositionDecision(
  id: string,
  input: {
    status: "approved" | "rejected";
    type?: DispositionType;
    quoteAmount?: number | null;
  },
): Promise<Disposition | null> {
  const result = await pool.query<Disposition>(
    `UPDATE dispositions
     SET status = $2,
         type = COALESCE($3, type),
         quote_amount = CASE WHEN $4 THEN $5 ELSE quote_amount END,
         approved_at = CASE WHEN $2 = 'approved' THEN now() ELSE approved_at END
     WHERE id = $1
     RETURNING *`,
    [
      id,
      input.status,
      input.type ?? null,
      input.quoteAmount !== undefined,
      input.quoteAmount ?? null,
    ],
  );
  return result.rows[0] ?? null;
}
