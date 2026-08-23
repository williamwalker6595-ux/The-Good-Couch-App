// Shapes reconstructed from Quo's public OpenAPI specs (messages, webhooks)
// via https://github.com/api-evangelist/openphone — direct fetch to quo.com
// is blocked from this environment. The messages API confirms a "text"
// field (not "body"); older webhook examples use "body", so inbound
// parsing falls back to "body" for resilience. Confirm against a real
// webhook delivery in the Quo dashboard before relying on this in prod.
export interface QuoMessageMedia {
  url: string;
  type: string;
}

export interface QuoMessage {
  id: string;
  object: "message";
  from: string;
  to: string[];
  direction: "incoming" | "outgoing";
  text?: string;
  body?: string;
  media?: QuoMessageMedia[];
  status: string;
  phoneNumberId?: string | null;
  conversationId?: string;
  userId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface QuoSendMessageResponse {
  data: QuoMessage;
}

export interface QuoWebhookEvent {
  id: string;
  object: "event";
  apiVersion?: string;
  createdAt: string;
  type: string;
  data: {
    object: QuoMessage;
  };
}

export function quoMessageText(message: QuoMessage): string {
  return message.text ?? message.body ?? "";
}
