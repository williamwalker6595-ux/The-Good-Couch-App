import type { MigrationBuilder } from "node-pg-migrate";

// Two-phase AI analysis over quo_history_conversations (session: playbook
// building from real conversation history). quo_history_summaries holds a
// cheap per-conversation extraction pass; ai_playbooks holds the final
// curated markdown synthesized from all of them.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("quo_history_summaries", {
    conversation_id: {
      type: "text",
      primaryKey: true,
      references: "quo_history_conversations",
      onDelete: "CASCADE",
    },
    summary: { type: "text", notNull: true },
    outcome: { type: "text", notNull: true },
    notable_pattern: { type: "text" },
    is_difficult: { type: "boolean", notNull: true },
    redacted_excerpt: { type: "text" },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.createTable("ai_playbooks", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    content: { type: "text", notNull: true },
    source_conversation_count: { type: "integer", notNull: true },
    generated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("ai_playbooks");
  pgm.dropTable("quo_history_summaries");
}
