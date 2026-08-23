import type { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createType("quote_customer_response", [
    "accepted",
    "declined",
    "countered",
  ]);

  pgm.createTable("quote_responses", {
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
    customer_response: { type: "quote_customer_response", notNull: true },
    discount_applied: { type: "numeric(10,2)" },
    final_amount: { type: "numeric(10,2)" },
    responded_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.createIndex("quote_responses", "lead_id");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("quote_responses");
  pgm.dropType("quote_customer_response");
}
