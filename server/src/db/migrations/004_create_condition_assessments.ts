import type { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("condition_assessments", {
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
    smoking_household: { type: "boolean" },
    pets: { type: "boolean" },
    blemishes: { type: "text" },
    odors: { type: "text" },
    stains: { type: "text" },
    notes: { type: "text" },
    photo_refs: { type: "text[]", notNull: true, default: "{}" },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.createIndex("condition_assessments", "lead_id");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("condition_assessments");
}
