import type { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn("condition_assessments", {
    seat_count: { type: "integer" },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn("condition_assessments", "seat_count");
}
