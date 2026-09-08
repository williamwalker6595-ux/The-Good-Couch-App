import { env } from "../../config/env";
import { QuoApiError } from "./client";

export interface QuoConversation {
  id: string;
  phoneNumberId: string;
  participants: string[];
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  name: string | null;
  deletedAt: string | null;
}

export interface QuoHistoryMessage {
  id: string;
  from: string;
  to: string[];
  direction: "incoming" | "outgoing";
  text?: string;
  body?: string;
  media?: { url: string; type: string }[];
  status: string;
  createdAt: string;
}

interface Page<T> {
  data: T[];
  nextPageToken: string | null;
}

async function quoGet<T>(
  path: string,
  params: Record<string, string | string[] | number | undefined>,
): Promise<T> {
  const url = new URL(`${env.quoApiBaseUrl}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) url.searchParams.append(key, v);
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: { Authorization: env.quoApiKey },
  });
  const bodyText = await response.text();
  if (!response.ok) {
    throw new QuoApiError(response.status, bodyText);
  }
  return JSON.parse(bodyText) as T;
}

export async function listConversationsPage(opts: {
  maxResults?: number;
  pageToken?: string;
  createdAfter?: string;
  createdBefore?: string;
}): Promise<Page<QuoConversation>> {
  return quoGet<Page<QuoConversation>>("/v1/conversations", {
    maxResults: opts.maxResults ?? 100,
    pageToken: opts.pageToken,
    createdAfter: opts.createdAfter,
    createdBefore: opts.createdBefore,
  });
}

export async function* iterateAllConversations(opts: {
  createdAfter?: string;
  createdBefore?: string;
}): AsyncGenerator<QuoConversation> {
  let pageToken: string | undefined;
  do {
    const page = await listConversationsPage({ ...opts, pageToken });
    for (const conversation of page.data) {
      yield conversation;
    }
    pageToken = page.nextPageToken ?? undefined;
  } while (pageToken);
}

export async function listMessagesPage(opts: {
  phoneNumberId: string;
  participants: string[];
  maxResults?: number;
  pageToken?: string;
  createdAfter?: string;
  createdBefore?: string;
}): Promise<Page<QuoHistoryMessage>> {
  return quoGet<Page<QuoHistoryMessage>>("/v1/messages", {
    phoneNumberId: opts.phoneNumberId,
    participants: opts.participants,
    maxResults: opts.maxResults ?? 100,
    pageToken: opts.pageToken,
    createdAfter: opts.createdAfter,
    createdBefore: opts.createdBefore,
  });
}

export async function* iterateAllMessages(opts: {
  phoneNumberId: string;
  participants: string[];
  createdAfter?: string;
  createdBefore?: string;
}): AsyncGenerator<QuoHistoryMessage> {
  let pageToken: string | undefined;
  do {
    const page = await listMessagesPage({ ...opts, pageToken });
    for (const message of page.data) {
      yield message;
    }
    pageToken = page.nextPageToken ?? undefined;
  } while (pageToken);
}
