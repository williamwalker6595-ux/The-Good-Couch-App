import { pool } from "../pool";

export type MessageDirection = "in" | "out";

export interface ConversationMessage {
  id: string;
  lead_id: string;
  direction: MessageDirection;
  body: string | null;
  media_urls: string[];
  quo_message_id: string | null;
  created_at: Date;
}

export async function insertConversationMessage(input: {
  leadId: string;
  direction: MessageDirection;
  body?: string;
  mediaUrls?: string[];
  quoMessageId?: string;
}): Promise<ConversationMessage> {
  const result = await pool.query<ConversationMessage>(
    `INSERT INTO conversation_messages (lead_id, direction, body, media_urls, quo_message_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      input.leadId,
      input.direction,
      input.body ?? null,
      input.mediaUrls ?? [],
      input.quoMessageId ?? null,
    ],
  );
  return result.rows[0];
}

export async function findConversationMessageByQuoId(
  quoMessageId: string,
): Promise<ConversationMessage | null> {
  const result = await pool.query<ConversationMessage>(
    "SELECT * FROM conversation_messages WHERE quo_message_id = $1 LIMIT 1",
    [quoMessageId],
  );
  return result.rows[0] ?? null;
}

export async function listConversationMessagesByLead(
  leadId: string,
): Promise<ConversationMessage[]> {
  const result = await pool.query<ConversationMessage>(
    "SELECT * FROM conversation_messages WHERE lead_id = $1 ORDER BY created_at ASC",
    [leadId],
  );
  return result.rows;
}
