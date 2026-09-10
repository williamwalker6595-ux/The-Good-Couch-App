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
  thumbnail_url: string | null;
}

// The earliest photo the customer sent, used as a lead-list preview so you
// can recognize a couch at a glance without opening every lead.
const THUMBNAIL_JOIN = `
  LEFT JOIN LATERAL (
    SELECT cm.media_urls[1] AS thumbnail_url
    FROM conversation_messages cm
    WHERE cm.lead_id = leads.id
      AND cm.direction = 'in'
      AND cardinality(cm.media_urls) > 0
    ORDER BY cm.created_at ASC
    LIMIT 1
  ) thumb ON true
`;

export async function findLeadByPhone(phone: string): Promise<Lead | null> {
  const result = await pool.query<Lead>(
    `SELECT leads.*, thumb.thumbnail_url FROM leads
     ${THUMBNAIL_JOIN}
     WHERE leads.phone = $1 LIMIT 1`,
    [phone],
  );
  return result.rows[0] ?? null;
}

export async function getLeadById(id: string): Promise<Lead | null> {
  const result = await pool.query<Lead>(
    `SELECT leads.*, thumb.thumbnail_url FROM leads
     ${THUMBNAIL_JOIN}
     WHERE leads.id = $1 LIMIT 1`,
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

export async function updateLeadStatus(
  id: string,
  status: LeadStatus,
): Promise<Lead | null> {
  const result = await pool.query<Lead>(
    `UPDATE leads SET status = $2 WHERE id = $1 RETURNING *`,
    [id, status],
  );
  return result.rows[0] ?? null;
}

export async function updateLeadAddress(
  id: string,
  address: string,
): Promise<Lead | null> {
  const result = await pool.query<Lead>(
    `UPDATE leads SET address = $2 WHERE id = $1 RETURNING *`,
    [id, address],
  );
  return result.rows[0] ?? null;
}

export async function listLeads(filter?: {
  status?: LeadStatus;
}): Promise<Lead[]> {
  if (filter?.status) {
    const result = await pool.query<Lead>(
      `SELECT leads.*, thumb.thumbnail_url FROM leads
       ${THUMBNAIL_JOIN}
       WHERE leads.status = $1
       ORDER BY leads.created_at DESC`,
      [filter.status],
    );
    return result.rows;
  }
  const result = await pool.query<Lead>(
    `SELECT leads.*, thumb.thumbnail_url FROM leads
     ${THUMBNAIL_JOIN}
     ORDER BY leads.created_at DESC`,
  );
  return result.rows;
}
