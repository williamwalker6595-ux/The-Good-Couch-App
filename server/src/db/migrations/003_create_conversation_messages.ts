import type { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createType("message_direction", ["in", "out"]);

  pgm.createTable("conversation_messages", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    lead_id: {
      type: "uuid",
      notNull: true,
      references: "leads",
      onDelete: "CASCADE",
    },
    direction: { type: "message_direction", notNull: true },
    body: { type: "text" },
    media_urls: { type: "text[]", notNull: true, default: "{}" },
    quo_message_id: { type: "text" },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.createIndex("conversation_messages", "lead_id");
  pgm.createIndex("conversation_messages", "quo_message_id");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("conversation_messages");
  pgm.dropType("message_direction");
}
