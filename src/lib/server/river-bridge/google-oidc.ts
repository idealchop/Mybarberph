import "server-only";
import { createPublicKey, verify as verifySig, type JsonWebKey, type KeyObject } from "node:crypto";
import type { OidcVerifier } from "./verify";

/**
 * Factor 1: Google-signed OIDC ID tokens, verified with Google's published keys (no extra dependency).
 * Issuer accounts.google.com, RS256, exact audience, unexpired, verified email.
 */
const CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
const CLOCK_SKEW_S = 60;

type Jwk = JsonWebKey & { kid?: string };
type KeySet = Map<string, KeyObject>;

const b64url = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

export function keySetFromJwks(jwks: { keys?: Jwk[] }): KeySet {
  const out: KeySet = new Map();
  for (const k of jwks.keys ?? []) {
    if (!k.kid || k.kty !== "RSA") continue;
    try { out.set(k.kid, createPublicKey({ key: k, format: "jwk" })); } catch { /* skip a bad key */ }
  }
  return out;
}

/** Pure check of one token against a key set. Throws on any failure (the caller maps it to a generic 401). */
export function verifyGoogleIdToken(token: string, audience: string, keys: KeySet, now = Date.now()): { email: string; audience: string } {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("oidc");
  const [h, p, sig] = parts as [string, string, string];
  const header = JSON.parse(b64url(h).toString("utf8")) as { alg?: string; kid?: string };
  if (header.alg !== "RS256" || !header.kid) throw new Error("oidc");
  const key = keys.get(header.kid);
  if (!key) throw new Error("oidc_kid");
  if (!verifySig("RSA-SHA256", Buffer.from(`${h}.${p}`), key, b64url(sig))) throw new Error("oidc");
  const c = JSON.parse(b64url(p).toString("utf8")) as { iss?: string; aud?: string | string[]; exp?: number; iat?: number; email?: string; email_verified?: boolean };
  const t = Math.floor(now / 1000);
  if (!c.iss || !ISSUERS.has(c.iss)) throw new Error("oidc");
  const audOk = c.aud === audience || (Array.isArray(c.aud) && c.aud.includes(audience));
  if (!audOk) throw new Error("oidc");
  if (typeof c.exp !== "number" || c.exp + CLOCK_SKEW_S < t) throw new Error("oidc");
  if (typeof c.iat === "number" && c.iat - CLOCK_SKEW_S > t) throw new Error("oidc");
  if (!c.email || c.email_verified !== true) throw new Error("oidc");
  return { email: c.email, audience };
}

let cache: { keys: KeySet; until: number } | null = null;

async function googleKeys(force = false): Promise<KeySet> {
  if (!force && cache && cache.until > Date.now()) return cache.keys;
  const res = await fetch(CERTS_URL, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error("oidc_certs");
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get("cache-control") || "")?.[1]) || 3600;
  const keys = keySetFromJwks((await res.json()) as { keys?: Jwk[] });
  cache = { keys, until: Date.now() + Math.min(maxAge, 6 * 3600) * 1000 };
  return keys;
}

export function googleOidcVerifier(): OidcVerifier {
  return {
    async verify(idToken: string, audience: string) {
      try {
        return verifyGoogleIdToken(idToken, audience, await googleKeys());
      } catch (e) {
        // Google rotates keys: refetch once on an unknown kid.
        if ((e as Error).message !== "oidc_kid") throw e;
        return verifyGoogleIdToken(idToken, audience, await googleKeys(true));
      }
    },
  };
}

/**
 * Mints a Google ID token for this runtime's service account (App Hosting / Cloud Run metadata server),
 * audience = the webhook URL. The token is never logged.
 */
export async function mintIdToken(audience: string): Promise<string> {
  const url = `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(audience)}&format=full`;
  const res = await fetch(url, { headers: { "Metadata-Flavor": "Google" }, signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`metadata identity ${res.status}`);
  const token = (await res.text()).trim();
  if (token.split(".").length !== 3) throw new Error("metadata identity: not a JWT");
  return token;
}
