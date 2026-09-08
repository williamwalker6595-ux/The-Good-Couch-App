import { pool } from "../pool";

export interface QuoHistorySummary {
  conversation_id: string;
  summary: string;
  outcome: string;
  notable_pattern: string | null;
  is_difficult: boolean;
  redacted_excerpt: string | null;
  created_at: Date;
}

export async function hasQuoHistorySummary(
  conversationId: string,
): Promise<boolean> {
  const result = await pool.query(
    "SELECT 1 FROM quo_history_summaries WHERE conversation_id = $1",
    [conversationId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function insertQuoHistorySummary(input: {
  conversationId: string;
  summary: string;
  outcome: string;
  notablePattern: string | null;
  isDifficult: boolean;
  redactedExcerpt: string | null;
}): Promise<void> {
  await pool.query(
    `INSERT INTO quo_history_summaries
       (conversation_id, summary, outcome, notable_pattern, is_difficult, redacted_excerpt)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (conversation_id) DO NOTHING`,
    [
      input.conversationId,
      input.summary,
      input.outcome,
      input.notablePattern,
      input.isDifficult,
      input.redactedExcerpt,
    ],
  );
}

export async function listAllQuoHistorySummaries(): Promise<
  QuoHistorySummary[]
> {
  const result = await pool.query<QuoHistorySummary>(
    "SELECT * FROM quo_history_summaries ORDER BY created_at ASC",
  );
  return result.rows;
}

export async function countQuoHistorySummaries(): Promise<number> {
  const result = await pool.query<{ count: string }>(
    "SELECT COUNT(*) FROM quo_history_summaries",
  );
  return Number(result.rows[0].count);
}
