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
  seat_count: number | null;
  photo_refs: string[];
  created_at: string;
}

export type DispositionType = "free" | "mileage" | "full";

export const DISPOSITION_TYPES: DispositionType[] = ["free", "mileage", "full"];

export interface Disposition {
  id: string;
  lead_id: string;
  type: DispositionType;
  suggested_by: "agent" | "human";
  confidence: number | null;
  quote_amount: string | null;
  reasoning: string | null;
  status: "pending_approval" | "approved" | "rejected";
  approved_at: string | null;
  created_at: string;
}

export type QuoteCustomerResponse = "accepted" | "declined" | "countered";

export const QUOTE_CUSTOMER_RESPONSES: QuoteCustomerResponse[] = [
  "accepted",
  "declined",
  "countered",
];

export interface QuoteResponse {
  id: string;
  lead_id: string;
  customer_response: QuoteCustomerResponse;
  discount_applied: string | null;
  final_amount: string | null;
  responded_at: string;
}

export interface QuoteOption {
  amount: number | null;
  distanceMiles: number | null;
  seatCount: number | null;
  explanation: string | null;
  blockedReason: string | null;
}

export interface QuoteOptions {
  free: QuoteOption;
  mileage: QuoteOption;
  full: QuoteOption;
}

export interface ScheduleSlot {
  id: string;
  lead_id: string;
  todoist_task_id: string | null;
  pickup_datetime: string | null;
  status: string;
  created_at: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export function mediaProxyUrl(url: string): string {
  return `${API_BASE_URL}/media/proxy?url=${encodeURIComponent(url)}`;
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`GET ${path} failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(
      `POST ${path} failed: ${response.status}${
        detail?.error ? ` - ${JSON.stringify(detail.error)}` : ""
      }`,
    );
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

export function extractLeadConditionAssessment(
  leadId: string,
): Promise<ConditionAssessment> {
  return apiPost<ConditionAssessment>(
    `/leads/${leadId}/condition-assessment/extract`,
  );
}

export function fetchLeadDisposition(
  leadId: string,
): Promise<Disposition | null> {
  return apiGet<Disposition | null>(`/leads/${leadId}/disposition`);
}

export function suggestLeadDisposition(leadId: string): Promise<Disposition> {
  return apiPost<Disposition>(`/leads/${leadId}/disposition/suggest`);
}

export function approveLeadDisposition(
  leadId: string,
  dispositionId: string,
  override: { type?: DispositionType; quoteAmount?: number | null },
): Promise<Disposition> {
  return apiPost<Disposition>(
    `/leads/${leadId}/disposition/${dispositionId}/approve`,
    override,
  );
}

export function rejectLeadDisposition(
  leadId: string,
  dispositionId: string,
): Promise<Disposition> {
  return apiPost<Disposition>(
    `/leads/${leadId}/disposition/${dispositionId}/reject`,
  );
}

export function fetchLeadQuoteOptions(
  leadId: string,
  seatCountOverride?: number | null,
): Promise<QuoteOptions> {
  const query =
    seatCountOverride !== undefined && seatCountOverride !== null
      ? `?seatCount=${seatCountOverride}`
      : "";
  return apiGet<QuoteOptions>(
    `/leads/${leadId}/disposition/quote-options${query}`,
  );
}

export function quickApproveDisposition(
  leadId: string,
  type: DispositionType,
  seatCountOverride?: number | null,
): Promise<Disposition> {
  return apiPost<Disposition>(`/leads/${leadId}/disposition/quick-approve`, {
    type,
    ...(seatCountOverride !== undefined
      ? { seatCount: seatCountOverride }
      : {}),
  });
}

export function composeQuoteMessagePreview(disposition: Disposition): string {
  if (disposition.type === "free") {
    return "Good news — your couch qualifies for a free pickup! Let us know if that works for you and we'll get you scheduled.";
  }
  const amount = disposition.quote_amount
    ? `$${Number(disposition.quote_amount).toFixed(0)}`
    : "a pickup fee";
  return `Thank you! We can offer to pick up the couch for ${amount}. We accept credit card, Venmo, or cash. Let us know if that works for you and we'll get you scheduled.`;
}

export function sendLeadQuote(
  leadId: string,
  content?: string,
): Promise<{ message: ConversationMessage; lead: Lead }> {
  return apiPost<{ message: ConversationMessage; lead: Lead }>(
    `/leads/${leadId}/quote/send`,
    content ? { content } : undefined,
  );
}

export function fetchLeadQuoteResponse(
  leadId: string,
): Promise<QuoteResponse | null> {
  return apiGet<QuoteResponse | null>(`/leads/${leadId}/quote-response`);
}

export function recordLeadQuoteResponse(
  leadId: string,
  input: {
    customerResponse: QuoteCustomerResponse;
    finalAmount?: number | null;
    discountApplied?: number | null;
  },
): Promise<QuoteResponse> {
  return apiPost<QuoteResponse>(`/leads/${leadId}/quote-response`, input);
}

export function fetchLeadSchedule(
  leadId: string,
): Promise<ScheduleSlot | null> {
  return apiGet<ScheduleSlot | null>(`/leads/${leadId}/schedule`);
}

export function createLeadScheduleTask(
  leadId: string,
): Promise<ScheduleSlot> {
  return apiPost<ScheduleSlot>(`/leads/${leadId}/schedule/create-task`);
}

export function confirmLeadSchedule(
  leadId: string,
  pickupDatetime: string,
): Promise<ScheduleSlot> {
  return apiPost<ScheduleSlot>(`/leads/${leadId}/schedule`, {
    pickupDatetime,
  });
}
