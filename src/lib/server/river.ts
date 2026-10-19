import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { json } from "./auth";

/** River Mobile → Barbers.ph partner API key check (env RIVER_MOBILE_API_KEY). Returns an error Response or null. */
export function riverAuth(req: Request): Response | null {
  const key = (process.env.RIVER_MOBILE_API_KEY || "").trim();
  if (!key) return json({ error: "River Mobile API is not configured on this server.", code: "not_configured" }, 503);
  const given = req.headers.get("x-api-key") || (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(key).digest();
  if (!given || !timingSafeEqual(a, b)) return json({ error: "Invalid API key", code: "unauthenticated" }, 401);
  return null;
}
