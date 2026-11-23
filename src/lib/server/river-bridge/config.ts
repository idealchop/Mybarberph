import "server-only";
import type { ActiveSecret } from "./verify";

/**
 * River Bridge ↔ Barbers.ph settings. Dev only for now (Jimboy, 2026-11-23): everything here fails
 * closed unless BARBERS_ENV=dev on barbersdb-dev with the dev-only secrets bound in apphosting.dev.yaml.
 * A prod deploy of this code answers 503 not_configured and sends no webhooks; it never falls back to
 * the old shared RIVER_MOBILE_API_KEY.
 */
export const DEV_ORIGIN = "https://barbers-ph-dev--mybarberph.asia-southeast1.hosted.app";
/** Prod audiences. A token minted for these is never accepted on dev. */
export const PROD_AUDIENCES = ["https://barbers-ph--mybarberph.asia-southeast1.hosted.app", "https://barbersph.web.app"] as const;
/** Factor 1 allowlist: the River Bridge service account (dev). */
export const BRIDGE_SERVICE_ACCOUNT_DEV = "248617671827-compute@developer.gserviceaccount.com";
/** Webhook receiver; also the OIDC audience this app mints for webhooks. */
export const WEBHOOK_URL_DEV = "https://asia-southeast1-rivermobile-ph.cloudfunctions.net/bridge/hooks/barbers";

/** Key ids → env var bound to the Secret Manager secret of the same name (apphosting.dev.yaml). */
export const REQUEST_KEYS = [
  { keyId: "bridge-to-barbers-dev-v1", env: "RIVER_BRIDGE_REQUEST_SECRET_V1" },
  { keyId: "bridge-to-barbers-dev-v2", env: "RIVER_BRIDGE_REQUEST_SECRET_V2" },
] as const;
export const WEBHOOK_KEYS = [
  { keyId: "barbers-to-bridge-dev-v1", env: "RIVER_BRIDGE_WEBHOOK_SECRET_V1" },
  { keyId: "barbers-to-bridge-dev-v2", env: "RIVER_BRIDGE_WEBHOOK_SECRET_V2" },
] as const;

export const SCOPES = ["shops:read", "orders:read", "orders:write", "checkin:write"] as const;
export type Scope = (typeof SCOPES)[number];
/** Scopes per caller. Only what Barbers.ph implements. */
const GRANTS: Record<string, readonly Scope[]> = { [BRIDGE_SERVICE_ACCOUNT_DEV]: SCOPES };
export function scopesFor(caller: string, devKey = false): readonly Scope[] {
  if (devKey) return SCOPES;
  return GRANTS[caller] ?? [];
}

type Env = Record<string, string | undefined>;
const DEV_DB = "barbersdb-dev";

function isDevStage(env: Env): boolean {
  const db = (env.FIRESTORE_DATABASE_ID || env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID || "").trim();
  return env.BARBERS_ENV === "dev" && db === DEV_DB;
}

const secretsFrom = (env: Env, keys: readonly { keyId: string; env: string }[]): ActiveSecret[] =>
  keys.map((k) => ({ keyId: k.keyId, secret: (env[k.env] || "").trim() })).filter((k) => k.secret.length > 0);

export type PartnerConfig =
  | { ok: true; audience: string; allowedEmails: string[]; secrets: ActiveSecret[]; allowKeyFallback: boolean; devApiKey?: string; requireHttps: boolean }
  | { ok: false; reason: string };

/** Receiver config for Bridge → Barbers requests, or why it is off. */
export function partnerConfig(env: Env = process.env): PartnerConfig {
  if (!isDevStage(env)) return { ok: false, reason: "not_dev_stage" };
  const audience = DEV_ORIGIN;
  if ((PROD_AUDIENCES as readonly string[]).includes(audience)) return { ok: false, reason: "prod_audience" };
  const secrets = secretsFrom(env, REQUEST_KEYS);
  if (!secrets.length) return { ok: false, reason: "no_request_secrets" };
  // Dev/emulator only: a per-app key may replace factor 1 (never HMAC). Never in a production build.
  const devApiKey = (env.RIVER_DEV_API_KEY || "").trim();
  const allowKeyFallback = env.NODE_ENV !== "production" && devApiKey.length >= 16;
  const requireHttps = env.NODE_ENV === "production" || env.RIVER_ALLOW_HTTP !== "1";
  return { ok: true, audience, allowedEmails: [BRIDGE_SERVICE_ACCOUNT_DEV], secrets, allowKeyFallback, devApiKey: allowKeyFallback ? devApiKey : undefined, requireHttps };
}

export type WebhookConfig = { ok: true; url: string; audience: string; keyId: string; secret: string } | { ok: false; reason: string };

/** Sender config for Barbers → Bridge status webhooks, or why they are off. */
export function webhookConfig(env: Env = process.env): WebhookConfig {
  if (!isDevStage(env)) return { ok: false, reason: "not_dev_stage" };
  if (env.RIVER_WEBHOOKS_ENABLED !== "1") return { ok: false, reason: "disabled" };
  const secrets = secretsFrom(env, WEBHOOK_KEYS);
  const wanted = (env.RIVER_WEBHOOK_KEY_ID || "").trim();
  const pick = (wanted && secrets.find((s) => s.keyId === wanted)) || secrets[0];
  if (!pick) return { ok: false, reason: "no_webhook_secret" };
  return { ok: true, url: WEBHOOK_URL_DEV, audience: WEBHOOK_URL_DEV, keyId: pick.keyId, secret: pick.secret };
}
