import { pool } from "../pool";
import { QuoHistoryMessage } from "../../integrations/quo/historyClient";

export async function hasQuoHistoryConversation(id: string): Promise<boolean> {
  const result = await pool.query("SELECT 1 FROM quo_history_conversations WHERE id = $1", [
    id,
  ]);
  return (result.rowCount ?? 0) > 0;
}

export async function insertQuoHistoryConversation(input: {
  id: string;
  phoneNumberId: string;
  participantPhone: string;
  messages: QuoHistoryMessage[];
  quoCreatedAt: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO quo_history_conversations
       (id, phone_number_id, participant_phone, message_count, messages, quo_created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO NOTHING`,
    [
      input.id,
      input.phoneNumberId,
      input.participantPhone,
      input.messages.length,
      JSON.stringify(input.messages),
      input.quoCreatedAt,
    ],
  );
}

export async function countQuoHistoryConversations(): Promise<number> {
  const result = await pool.query<{ count: string }>(
    "SELECT COUNT(*) FROM quo_history_conversations",
  );
  return Number(result.rows[0].count);
}
