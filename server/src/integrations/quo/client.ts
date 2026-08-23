import { env } from "../../config/env";
import { QuoMessage, QuoSendMessageResponse } from "./types";

export class QuoApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`Quo API error (${status}): ${body}`);
  }
}

export interface SendMessageInput {
  to: string;
  content: string;
  from?: string;
  userId?: string;
}

export async function sendQuoMessage(
  input: SendMessageInput,
): Promise<QuoMessage> {
  const from = input.from ?? env.quoFromNumber;
  if (!from) {
    throw new Error(
      "No Quo 'from' number configured (set QUO_FROM_NUMBER or pass one explicitly)",
    );
  }

  const response = await fetch(`${env.quoApiBaseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      Authorization: env.quoApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: input.content,
      from,
      to: [input.to],
      ...(input.userId ? { userId: input.userId } : {}),
    }),
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw new QuoApiError(response.status, bodyText);
  }

  const parsed = JSON.parse(bodyText) as QuoSendMessageResponse;
  return parsed.data;
}
