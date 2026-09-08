import { QuoHistoryMessage } from "../integrations/quo/historyClient";

// Conservative on purpose: only drops conversations with no real exchange
// at all. Difficult, messy, or declined conversations are kept — those are
// exactly the scenarios the AI playbook needs examples of.
const NOISE_REPLY_PATTERN =
  /^(stop|unsubscribe|opt ?out|wrong number|who('?s| is)? this\??|do not text( me)?|don'?t text( me)?|remove me)[.!]?$/i;

function messageText(message: QuoHistoryMessage): string {
  return (message.text ?? message.body ?? "").trim();
}

export function isSubstantiveConversation(
  messages: QuoHistoryMessage[],
): boolean {
  if (messages.length < 2) return false;

  const inbound = messages.filter((m) => m.direction === "incoming");
  if (inbound.length === 0) return false;

  const allNoise = inbound.every((m) => NOISE_REPLY_PATTERN.test(messageText(m)));
  if (allNoise) return false;

  return true;
}
