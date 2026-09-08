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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1000;
    const dateMs = Date.parse(retryAfter);
    if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());
  }
  return Math.min(30_000, 1000 * 2 ** attempt);
}

const MAX_RETRIES = 6;

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

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      headers: { Authorization: env.quoApiKey },
    });

    if (response.status === 429 || response.status >= 500) {
      if (attempt === MAX_RETRIES) {
        throw new QuoApiError(response.status, await response.text());
      }
      const delay = retryDelayMs(response, attempt);
      console.log(
        `Quo API ${response.status}, retrying in ${Math.round(delay / 1000)}s (attempt ${attempt + 1}/${MAX_RETRIES})`,
      );
      await sleep(delay);
      continue;
    }

    const bodyText = await response.text();
    if (!response.ok) {
      throw new QuoApiError(response.status, bodyText);
    }
    return JSON.parse(bodyText) as T;
  }

  throw new QuoApiError(0, "unreachable");
}

export async function listConversationsPage(opts: {
  maxResults?: number;
  pageToken?: string;
  createdAfter?: string;
  createdBefore?: string;
  phoneNumbers?: string[];
}): Promise<Page<QuoConversation>> {
  return quoGet<Page<QuoConversation>>("/v1/conversations", {
    maxResults: opts.maxResults ?? 100,
    pageToken: opts.pageToken,
    createdAfter: opts.createdAfter,
    createdBefore: opts.createdBefore,
    phoneNumbers: opts.phoneNumbers,
  });
}

const PAGE_PACING_MS = 400;

export async function* iterateAllConversations(opts: {
  createdAfter?: string;
  createdBefore?: string;
  phoneNumbers?: string[];
}): AsyncGenerator<QuoConversation> {
  let pageToken: string | undefined;
  do {
    const page = await listConversationsPage({ ...opts, pageToken });
    for (const conversation of page.data) {
      yield conversation;
    }
    pageToken = page.nextPageToken ?? undefined;
    if (pageToken) await sleep(PAGE_PACING_MS);
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
