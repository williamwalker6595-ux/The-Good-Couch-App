import { Disposition } from "../db/repositories/dispositions";

export function composeQuoteMessage(disposition: Disposition): string {
  if (disposition.type === "free") {
    return "Good news — your couch qualifies for a free pickup! Let us know if that works for you and we'll get you scheduled.";
  }

  const amount = disposition.quote_amount
    ? `$${Number(disposition.quote_amount).toFixed(0)}`
    : "a pickup fee";

  return `Thank you! We can offer to pick up the couch for ${amount}. We accept credit card, Venmo, or cash. Let us know if that works for you and we'll get you scheduled.`;
}
