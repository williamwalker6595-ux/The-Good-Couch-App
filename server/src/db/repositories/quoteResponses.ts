import { pool } from "../pool";

export type QuoteCustomerResponse = "accepted" | "declined" | "countered";

export interface QuoteResponse {
  id: string;
  lead_id: string;
  customer_response: QuoteCustomerResponse;
  discount_applied: string | null;
  final_amount: string | null;
  responded_at: Date;
}

export async function insertQuoteResponse(input: {
  leadId: string;
  customerResponse: QuoteCustomerResponse;
  discountApplied?: number | null;
  finalAmount?: number | null;
}): Promise<QuoteResponse> {
  const result = await pool.query<QuoteResponse>(
    `INSERT INTO quote_responses (lead_id, customer_response, discount_applied, final_amount)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [
      input.leadId,
      input.customerResponse,
      input.discountApplied ?? null,
      input.finalAmount ?? null,
    ],
  );
  return result.rows[0];
}

export async function getLatestQuoteResponseByLead(
  leadId: string,
): Promise<QuoteResponse | null> {
  const result = await pool.query<QuoteResponse>(
    `SELECT * FROM quote_responses
     WHERE lead_id = $1
     ORDER BY responded_at DESC
     LIMIT 1`,
    [leadId],
  );
  return result.rows[0] ?? null;
}
