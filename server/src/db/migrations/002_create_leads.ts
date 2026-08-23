import type { MigrationBuilder } from "node-pg-migrate";

const LEAD_STATUS_VALUES = [
  "new",
  "qualifying",
  "awaiting_disposition",
  "disposition_approved",
  "quote_sent",
  "accepted",
  "declined",
  "scheduled",
];

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createType("lead_status", LEAD_STATUS_VALUES);

  pgm.createTable("leads", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    name: { type: "text", notNull: true },
    phone: { type: "text", notNull: true },
    address: { type: "text" },
    source: { type: "text" },
    status: { type: "lead_status", notNull: true, default: "new" },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.createIndex("leads", "status");
  pgm.createIndex("leads", "phone");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("leads");
  pgm.dropType("lead_status");
}
