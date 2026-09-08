export type LeadStatus =
  | "new"
  | "qualifying"
  | "awaiting_disposition"
  | "disposition_approved"
  | "quote_sent"
  | "accepted"
  | "declined"
  | "scheduled";

export const LEAD_STATUSES: LeadStatus[] = [
  "new",
  "qualifying",
  "awaiting_disposition",
  "disposition_approved",
  "quote_sent",
  "accepted",
  "declined",
  "scheduled",
];

export interface Lead {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  source: string | null;
  status: LeadStatus;
  created_at: string;
}

export interface ConversationMessage {
  id: string;
  lead_id: string;
  direction: "in" | "out";
  body: string | null;
  media_urls: string[];
  quo_message_id: string | null;
  created_at: string;
}

export interface ConditionAssessment {
  id: string;
  lead_id: string;
  smoking_household: boolean | null;
  pets: boolean | null;
  blemishes: string | null;
  odors: string | null;
  stains: string | null;
  notes: string | null;
  photo_refs: string[];
  created_at: string;
}

export interface Disposition {
  id: string;
  lead_id: string;
  type: "free" | "mileage" | "full";
  suggested_by: "agent" | "human";
  confidence: number | null;
  quote_amount: string | null;
  status: "pending_approval" | "approved" | "rejected";
  approved_at: string | null;
  created_at: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`GET ${path} failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function fetchLeads(status?: LeadStatus): Promise<Lead[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiGet<Lead[]>(`/leads${query}`);
}

export function fetchLead(leadId: string): Promise<Lead> {
  return apiGet<Lead>(`/leads/${leadId}`);
}

export function fetchLeadMessages(
  leadId: string,
): Promise<ConversationMessage[]> {
  return apiGet<ConversationMessage[]>(`/leads/${leadId}/messages`);
}

export function fetchLeadConditionAssessment(
  leadId: string,
): Promise<ConditionAssessment | null> {
  return apiGet<ConditionAssessment | null>(
    `/leads/${leadId}/condition-assessment`,
  );
}

export function fetchLeadDisposition(
  leadId: string,
): Promise<Disposition | null> {
  return apiGet<Disposition | null>(`/leads/${leadId}/disposition`);
}
