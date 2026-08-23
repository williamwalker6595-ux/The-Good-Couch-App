import { createHmac, timingSafeEqual } from "node:crypto";

// Quo signs webhook deliveries per the Standard Webhooks spec: headers
// webhook-id / webhook-timestamp / webhook-signature, secret prefixed
// "whsec_". See https://www.standardwebhooks.com/.
const TOLERANCE_SECONDS = 5 * 60;

export interface WebhookHeaders {
  "webhook-id"?: string;
  "webhook-timestamp"?: string;
  "webhook-signature"?: string;
}

export function verifyQuoWebhookSignature(
  headers: WebhookHeaders,
  rawBody: Buffer,
  signingKey: string,
): boolean {
  const id = headers["webhook-id"];
  const timestamp = headers["webhook-timestamp"];
  const signatureHeader = headers["webhook-signature"];
  if (!id || !timestamp || !signatureHeader) {
    return false;
  }

  const timestampSeconds = Number(timestamp);
  if (
    !Number.isFinite(timestampSeconds) ||
    Math.abs(Date.now() / 1000 - timestampSeconds) > TOLERANCE_SECONDS
  ) {
    return false;
  }

  const secretKey = Buffer.from(signingKey.replace(/^whsec_/, ""), "base64");
  const signedContent = `${id}.${timestamp}.${rawBody.toString("utf8")}`;
  const expected = createHmac("sha256", secretKey)
    .update(signedContent)
    .digest("base64");
  const expectedBuf = Buffer.from(expected);

  return signatureHeader
    .split(" ")
    .map((part) => part.split(",")[1])
    .filter((sig): sig is string => Boolean(sig))
    .some((sig) => {
      const sigBuf = Buffer.from(sig);
      return (
        sigBuf.length === expectedBuf.length &&
        timingSafeEqual(sigBuf, expectedBuf)
      );
    });
}
