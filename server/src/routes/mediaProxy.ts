import { Router } from "express";
import { env } from "../config/env";
import { asyncHandler } from "../middleware/asyncHandler";

export const mediaProxyRouter = Router();

const PRIVATE_HOSTNAME_PATTERN =
  /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0|::1)/i;

function isAllowedMediaHost(hostname: string): boolean {
  if (PRIVATE_HOSTNAME_PATTERN.test(hostname)) {
    return false;
  }
  if (hostname === "quo.com" || hostname.endsWith(".quo.com")) {
    return true;
  }
  if (env.quoApiBaseUrl) {
    try {
      if (hostname === new URL(env.quoApiBaseUrl).hostname) {
        return true;
      }
    } catch {
      // ignore malformed QUO_API_BASE_URL, fall through to reject
    }
  }
  return false;
}

// Relays a Quo media URL through the server (attaching the Quo API key) so
// the dashboard can display photos inline even if Quo's media endpoints
// require authentication a plain <img> tag can't provide. Restricted to
// Quo's own host(s) so this can't be used as an open proxy or leak the API
// key to an arbitrary third-party URL.
mediaProxyRouter.get(
  "/media/proxy",
  asyncHandler(async (req, res) => {
    const url = req.query.url;
    if (typeof url !== "string") {
      res.status(400).json({ error: "missing url" });
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      res.status(400).json({ error: "invalid url" });
      return;
    }

    if (parsed.protocol !== "https:" || !isAllowedMediaHost(parsed.hostname)) {
      res.status(400).json({ error: "url not allowed" });
      return;
    }

    const response = await fetch(url, {
      headers: env.quoApiKey ? { Authorization: env.quoApiKey } : undefined,
    });

    if (!response.ok) {
      res.status(502).json({ error: "failed to fetch media" });
      return;
    }

    const contentType =
      response.headers.get("content-type") ?? "application/octet-stream";
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    // The dashboard is served from a different origin than this API, and
    // helmet's default Cross-Origin-Resource-Policy would otherwise block
    // the browser from loading this image cross-origin regardless of CORS.
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.send(buffer);
  }),
);
