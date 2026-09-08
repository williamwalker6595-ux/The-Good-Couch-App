import { pool } from "../pool";

export const LEAD_STATUS_VALUES = [
  "new",
  "qualifying",
  "awaiting_disposition",
  "disposition_approved",
  "quote_sent",
  "accepted",
  "declined",
  "scheduled",
] as const;

export type LeadStatus = (typeof LEAD_STATUS_VALUES)[number];

export interface Lead {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  source: string | null;
  status: LeadStatus;
  created_at: Date;
}

export async function findLeadByPhone(phone: string): Promise<Lead | null> {
  const result = await pool.query<Lead>(
    "SELECT * FROM leads WHERE phone = $1 LIMIT 1",
    [phone],
  );
  return result.rows[0] ?? null;
}

export async function getLeadById(id: string): Promise<Lead | null> {
  const result = await pool.query<Lead>(
    "SELECT * FROM leads WHERE id = $1 LIMIT 1",
    [id],
  );
  return result.rows[0] ?? null;
}

export async function createLead(input: {
  name: string;
  phone: string;
  address?: string;
  source?: string;
}): Promise<Lead> {
  const result = await pool.query<Lead>(
    `INSERT INTO leads (name, phone, address, source)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.name, input.phone, input.address ?? null, input.source ?? null],
  );
  return result.rows[0];
}

export async function findOrCreateLeadByPhone(phone: string): Promise<Lead> {
  const existing = await findLeadByPhone(phone);
  if (existing) {
    return existing;
  }
  return createLead({ name: "Unknown", phone, source: "quo-inbound" });
}

export async function listLeads(filter?: {
  status?: LeadStatus;
}): Promise<Lead[]> {
  if (filter?.status) {
    const result = await pool.query<Lead>(
      "SELECT * FROM leads WHERE status = $1 ORDER BY created_at DESC",
      [filter.status],
    );
    return result.rows;
  }
  const result = await pool.query<Lead>(
    "SELECT * FROM leads ORDER BY created_at DESC",
  );
  return result.rows;
}
