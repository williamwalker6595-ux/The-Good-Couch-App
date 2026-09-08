import { pool } from "../pool";

export interface AiPlaybook {
  id: string;
  content: string;
  source_conversation_count: number;
  generated_at: Date;
}

export async function insertAiPlaybook(input: {
  content: string;
  sourceConversationCount: number;
}): Promise<AiPlaybook> {
  const result = await pool.query<AiPlaybook>(
    `INSERT INTO ai_playbooks (content, source_conversation_count)
     VALUES ($1, $2)
     RETURNING *`,
    [input.content, input.sourceConversationCount],
  );
  return result.rows[0];
}

export async function getLatestAiPlaybook(): Promise<AiPlaybook | null> {
  const result = await pool.query<AiPlaybook>(
    "SELECT * FROM ai_playbooks ORDER BY generated_at DESC LIMIT 1",
  );
  return result.rows[0] ?? null;
}
