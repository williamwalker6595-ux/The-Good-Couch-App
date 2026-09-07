import { createHmac, timingSafeEqual } from "node:crypto";

// Confirmed live via a real Quo "Test request" delivery: this account signs
// webhooks with the legacy `openphone-signature` header, not the newer
// Standard Webhooks scheme (webhook-id/webhook-timestamp/webhook-signature)
// some of Quo's public docs describe. Header format:
// "hmac;<version>;<timestamp-ms>;<base64 signature>". Signed content is
// `${timestamp}.${rawBody}`, HMAC-SHA256'd with the base64-decoded signing
// key (no "whsec_" prefix for this scheme). The newer scheme is kept as a
// fallback in case a workspace is migrated to it later.
const TOLERANCE_MS = 5 * 60 * 1000;
const TOLERANCE_SECONDS = 5 * 60;

export interface WebhookHeaders {
  "webhook-id"?: string;
  "webhook-timestamp"?: string;
  "webhook-signature"?: string;
  "openphone-signature"?: string;
}

export function verifyQuoWebhookSignature(
  headers: WebhookHeaders,
  rawBody: Buffer,
  signingKey: string,
): boolean {
  const legacyHeader = headers["openphone-signature"];
  if (legacyHeader) {
    return verifyLegacySignature(legacyHeader, rawBody, signingKey);
  }

  return verifyStandardWebhooksSignature(headers, rawBody, signingKey);
}

function verifyLegacySignature(
  header: string,
  rawBody: Buffer,
  signingKey: string,
): boolean {
  const parts = header.split(";");
  if (parts.length !== 4) {
    return false;
  }
  const [, , timestamp, signature] = parts;

  const timestampMs = Number(timestamp);
  if (
    !Number.isFinite(timestampMs) ||
    Math.abs(Date.now() - timestampMs) > TOLERANCE_MS
  ) {
    return false;
  }

  const secretKey = Buffer.from(signingKey, "base64");
  const signedContent = `${timestamp}.${rawBody.toString("utf8")}`;
  const expected = createHmac("sha256", secretKey)
    .update(signedContent)
    .digest("base64");

  const expectedBuf = Buffer.from(expected);
  const sigBuf = Buffer.from(signature);
  return (
    sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf)
  );
}

function verifyStandardWebhooksSignature(
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
