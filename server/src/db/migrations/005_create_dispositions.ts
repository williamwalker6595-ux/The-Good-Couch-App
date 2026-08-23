import type { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createType("disposition_type", ["free", "mileage", "full"]);
  pgm.createType("disposition_suggested_by", ["agent", "human"]);
  pgm.createType("disposition_status", [
    "pending_approval",
    "approved",
    "rejected",
  ]);

  pgm.createTable("dispositions", {
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
    type: { type: "disposition_type", notNull: true },
    suggested_by: { type: "disposition_suggested_by", notNull: true },
    confidence: { type: "real" },
    quote_amount: { type: "numeric(10,2)" },
    status: {
      type: "disposition_status",
      notNull: true,
      default: "pending_approval",
    },
    approved_at: { type: "timestamptz" },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.createIndex("dispositions", "lead_id");
  pgm.createIndex("dispositions", "status");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("dispositions");
  pgm.dropType("disposition_status");
  pgm.dropType("disposition_suggested_by");
  pgm.dropType("disposition_type");
}
