import type { MigrationBuilder } from "node-pg-migrate";

// One-time analysis table for the AI playbook-building work (session 8):
// holds a filtered subset of real historical Quo conversations, pulled and
// stored separately from the live app schema so this exploratory data
// never mixes with production leads/conversation_messages.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("quo_history_conversations", {
    id: { type: "text", primaryKey: true },
    phone_number_id: { type: "text", notNull: true },
    participant_phone: { type: "text", notNull: true },
    message_count: { type: "integer", notNull: true },
    messages: { type: "jsonb", notNull: true },
    quo_created_at: { type: "timestamptz", notNull: true },
    fetched_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.createIndex("quo_history_conversations", "quo_created_at");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("quo_history_conversations");
}
