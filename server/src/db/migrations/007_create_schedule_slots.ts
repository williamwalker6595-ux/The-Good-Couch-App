import type { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("schedule_slots", {
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
    todoist_task_id: { type: "text" },
    pickup_datetime: { type: "timestamptz" },
    status: { type: "text", notNull: true, default: "scheduled" },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.createIndex("schedule_slots", "lead_id");
  pgm.createIndex("schedule_slots", "todoist_task_id");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("schedule_slots");
}
