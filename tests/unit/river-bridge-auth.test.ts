import { generateKeyPairSync, createSign, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalString, normalizePath, sha256Hex } from "@/lib/server/river-bridge/canonical";
import { signRequest } from "@/lib/server/river-bridge/sign";
import { MemoryNonceStore } from "@/lib/server/river-bridge/nonce";
import { AUTH_LEAK_PATTERN } from "@/lib/server/river-bridge/problems";
import type { OidcVerifier } from "@/lib/server/river-bridge/verify";
import type { IdemRecord, IdemStore } from "@/lib/server/river-bridge/stores";
import { withRiver, type RiverDeps } from "@/lib/server/river-bridge/partner";
import { BRIDGE_SERVICE_ACCOUNT_DEV, DEV_ORIGIN, PROD_AUDIENCES, partnerConfig, webhookConfig, type PartnerConfig } from "@/lib/server/river-bridge/config";
import { keySetFromJwks, verifyGoogleIdToken } from "@/lib/server/river-bridge/google-oidc";

// Test-only HMAC values (not real secrets).
const S1 = "test-request-secret-v1-0123456789abcdef";
const S2 = "test-request-secret-v2-fedcba9876543210";
const OTHER_SA = "someone-else@example.iam.gserviceaccount.com";

/** Fake factor 1: "jwt.<email>.<aud>" (three non-empty parts, like a JWT). */
const fakeOidc: OidcVerifier = {
  async verify(token, audience) {
    const [, email, aud] = token.split(".");
    if (!email || !aud) throw new Error("oidc");
    const decodedAud = Buffer.from(aud, "base64url").toString();
    if (decodedAud !== audience) throw new Error("oidc");
    return { email: Buffer.from(email, "base64url").toString(), audience: decodedAud };
  },
};
const tok = (email = BRIDGE_SERVICE_ACCOUNT_DEV, aud = DEV_ORIGIN) => `jwt.${Buffer.from(email).toString("base64url")}.${Buffer.from(aud).toString("base64url")}`;

class MemIdem implements IdemStore {
  rows = new Map<string, IdemRecord>();
  async reserve(id: string, bodyHash: string) { if (this.rows.has(id)) return "exists" as const; this.rows.set(id, { bodyHash, state: "pending" }); return "created" as const; }
  async get(id: string) { return this.rows.get(id) ?? null; }
  async complete(id: string, r: { status: number; contentType: string; body: string }) { this.rows.set(id, { ...this.rows.get(id)!, state: "done", ...r }); }
  async release(id: string) { this.rows.delete(id); }
}

const config = (over: Partial<Extract<PartnerConfig, { ok: true }>> = {}): PartnerConfig => ({
  ok: true, audience: DEV_ORIGIN, allowedEmails: [BRIDGE_SERVICE_ACCOUNT_DEV], allowKeyFallback: false, requireHttps: true,
  secrets: [{ keyId: "bridge-to-barbers-dev-v1", secret: S1 }, { keyId: "bridge-to-barbers-dev-v2", secret: S2 }], ...over,
});

function signed(path: string, opts: { method?: string; body?: string; keyId?: string; secret?: string; token?: string; now?: Date; nonce?: string; idem?: string } = {}) {
  const method = opts.method ?? "GET";
  const s = signRequest({ method, pathWithQuery: path, body: opts.body ?? "", keyId: opts.keyId ?? "bridge-to-barbers-dev-v1", secret: opts.secret ?? S1, authorization: `Bearer ${opts.token ?? tok()}`, now: opts.now, nonce: opts.nonce, idempotencyKey: opts.idem });
  return new Request(`${DEV_ORIGIN}${path}`, { method, headers: s.headers, body: method === "GET" ? undefined : opts.body ?? "" });
}

function harness(over: Partial<RiverDeps> = {}) {
  const logs: Record<string, unknown>[] = [];
  const deps: RiverDeps = { config: config(), oidc: fakeOidc, nonces: new MemoryNonceStore(), idem: new MemIdem(), log: (l) => logs.push(l), ...over };
  let calls = 0;
  const run = (req: Request, opts: { scope: "shops:read" | "orders:read" | "orders:write" | "checkin:write"; write?: boolean } = { scope: "shops:read" }) =>
    withRiver(req, opts, async (ctx) => { calls++; return Response.json({ ok: true, n: calls, body: ctx.body }, { status: opts.write ? 201 : 200 }); }, deps);
  return { deps, logs, run, calls: () => calls };
}

describe("canonical string (bridge-kit v1)", () => {
  it("TC-RB-CANON-01 is v1\\nMETHOD\\nPATH?SORTED_QUERY\\nTIMESTAMP\\nNONCE\\nsha256(body)", () => {
    const c = canonicalString({ method: "post", pathWithQuery: "/api/river/v1/shops?lng=121&lat=14.5", timestamp: "1700000000", nonce: "n-1", body: '{"a":1}' });
    expect(c).toBe(["v1", "POST", "/api/river/v1/shops?lat=14.5&lng=121", "1700000000", "n-1", sha256Hex('{"a":1}')].join("\n"));
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(normalizePath("/x?b=2&a=1&a=0")).toBe("/x?a=0&a=1&b=2");
  });
});

describe("withRiver: OIDC + HMAC receiver", () => {
  it("TC-RB-HP-01 accepts both active key versions", async () => {
    const h = harness();
    expect((await h.run(signed("/api/river/v1/shops"))).status).toBe(200);
    expect((await h.run(signed("/api/river/v1/shops", { keyId: "bridge-to-barbers-dev-v2", secret: S2 }))).status).toBe(200);
  });

  it("TC-RB-NEG-01 a removed version, an unknown key id or the wrong secret is 401", async () => {
    const onlyV2 = harness({ config: config({ secrets: [{ keyId: "bridge-to-barbers-dev-v2", secret: S2 }] }) });
    expect((await onlyV2.run(signed("/api/river/v1/shops"))).status).toBe(401);
    const h = harness();
    expect((await h.run(signed("/api/river/v1/shops", { keyId: "bridge-to-barbers-prod-v1" }))).status).toBe(401);
    expect((await h.run(signed("/api/river/v1/shops", { keyId: "bridge-to-barbers-dev-v1", secret: S2 }))).status).toBe(401);
    expect(h.calls()).toBe(0);
  });

  it("TC-RB-NEG-02 nonce replay is 401", async () => {
    const h = harness();
    const nonce = randomUUID();
    expect((await h.run(signed("/api/river/v1/shops", { nonce }))).status).toBe(200);
    expect((await h.run(signed("/api/river/v1/shops", { nonce }))).status).toBe(401);
  });

  it("TC-RB-NEG-03 timestamps ±6 minutes are 401; ±4 minutes pass", async () => {
    const h = harness();
    const t = Date.now();
    expect((await h.run(signed("/api/river/v1/shops", { now: new Date(t - 6 * 60_000) }))).status).toBe(401);
    expect((await h.run(signed("/api/river/v1/shops", { now: new Date(t + 6 * 60_000) }))).status).toBe(401);
    expect((await h.run(signed("/api/river/v1/shops", { now: new Date(t - 4 * 60_000) }))).status).toBe(200);
  });

  it("TC-RB-NEG-04 a body changed after signing is 401", async () => {
    const h = harness();
    const s = signRequest({ method: "POST", pathWithQuery: "/api/river/v1/orders/x1/cancel", body: '{"reason":"a"}', keyId: "bridge-to-barbers-dev-v1", secret: S1, authorization: `Bearer ${tok()}`, idempotencyKey: "idem-key-0001" });
    const req = new Request(`${DEV_ORIGIN}/api/river/v1/orders/x1/cancel`, { method: "POST", headers: s.headers, body: '{"reason":"b"}' });
    expect((await h.run(req, { scope: "orders:write", write: true })).status).toBe(401);
  });

  it("TC-RB-NEG-05 missing token, wrong service account, prod audience and plain HTTP are 401 with a generic body", async () => {
    const h = harness();
    const noTok = signed("/api/river/v1/shops");
    const hdr = new Headers(noTok.headers); hdr.delete("authorization");
    const cases = [
      new Request(noTok.url, { headers: hdr }),
      signed("/api/river/v1/shops", { token: tok(OTHER_SA) }),
      ...PROD_AUDIENCES.map((aud) => signed("/api/river/v1/shops", { token: tok(BRIDGE_SERVICE_ACCOUNT_DEV, aud) })),
      new Request(`http://barbers.local/api/river/v1/shops`, { headers: signed("/api/river/v1/shops").headers }),
    ];
    for (const req of cases) {
      const res = await h.run(req);
      expect(res.status).toBe(401);
      expect(res.headers.get("content-type")).toBe("application/problem+json");
      const text = await res.text();
      expect(JSON.parse(text).code).toBe("unauthorized");
      expect(text).not.toMatch(AUTH_LEAK_PATTERN);
    }
    expect(h.calls()).toBe(0);
  });

  it("TC-RB-NEG-06 a non-JWT bearer (old shared key) is refused unless the dev-key fallback is on", async () => {
    const h = harness();
    expect((await h.run(signed("/api/river/v1/shops", { token: "rk_shared_old_key" }))).status).toBe(401);
    const dev = harness({ config: config({ allowKeyFallback: true, devApiKey: "local-dev-key-123456" }) });
    expect((await dev.run(signed("/api/river/v1/shops", { token: "local-dev-key-123456" }))).status).toBe(200);
  });

  it("TC-RB-NEG-07 a valid caller without the scope is 403 forbidden", async () => {
    const h = harness({ config: config({ allowedEmails: [BRIDGE_SERVICE_ACCOUNT_DEV, OTHER_SA] }) });
    const res = await h.run(signed("/api/river/v1/shops", { token: tok(OTHER_SA) }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("forbidden");
  });

  it("TC-RB-NEG-08 not configured → 503, and bodies over 16 KB → 413", async () => {
    const off = harness({ config: { ok: false, reason: "not_dev_stage" } });
    expect((await off.run(signed("/api/river/v1/shops"))).status).toBe(503);
    const h = harness();
    const big = JSON.stringify({ x: "a".repeat(17 * 1024) });
    expect((await h.run(signed("/api/river/v1/orders/x/cancel", { method: "POST", body: big, idem: "idem-key-0002" }), { scope: "orders:write", write: true })).status).toBe(413);
  });

  it("TC-RB-AUDIT-01 every attempt is audit-logged without secrets or tokens", async () => {
    const h = harness();
    await h.run(signed("/api/river/v1/shops"));
    await h.run(signed("/api/river/v1/shops", { token: tok(OTHER_SA) }));
    expect(h.logs).toHaveLength(2);
    expect(h.logs[0]).toMatchObject({ type: "river_partner_audit", result: "allow", keyId: "bridge-to-barbers-dev-v1", caller: BRIDGE_SERVICE_ACCOUNT_DEV, method: "GET", path: "/api/river/v1/shops" });
    expect(h.logs[1]).toMatchObject({ result: "deny", status: 401, reason: "caller_not_allowed" });
    const all = JSON.stringify(h.logs);
    expect(all).not.toContain(S1);
    expect(all).not.toContain("jwt.");
    expect(h.logs.every((l) => typeof l.requestId === "string")).toBe(true);
  });
});

describe("Idempotency-Key on writes", () => {
  const post = (body: string, idem?: string) => signed("/api/river/v1/shops/s1/bookings", { method: "POST", body, idem });
  it("TC-RB-IDEM-01 missing or malformed key → 400; nothing runs", async () => {
    const h = harness();
    expect((await h.run(post("{}"), { scope: "orders:write", write: true })).status).toBe(400);
    expect((await h.run(post("{}", "short"), { scope: "orders:write", write: true })).status).toBe(400);
    expect(h.calls()).toBe(0);
  });
  it("TC-RB-IDEM-02 same key + same body replays the stored response; a different body is 422", async () => {
    const h = harness();
    const first = await h.run(post('{"a":1}', "idem-key-0100"), { scope: "orders:write", write: true });
    expect(first.status).toBe(201);
    const again = await h.run(post('{"a":1}', "idem-key-0100"), { scope: "orders:write", write: true });
    expect(again.status).toBe(201);
    expect(again.headers.get("idempotent-replayed")).toBe("true");
    expect(await again.json()).toEqual(await first.json());
    expect(h.calls()).toBe(1);
    const other = await h.run(post('{"a":2}', "idem-key-0100"), { scope: "orders:write", write: true });
    expect(other.status).toBe(422);
    expect((await other.json()).code).toBe("idempotency_key_reused");
  });
  it("TC-RB-IDEM-03 a 5xx is not remembered, so a retry with the same key runs again", async () => {
    const deps: RiverDeps = { config: config(), oidc: fakeOidc, nonces: new MemoryNonceStore(), idem: new MemIdem(), log: () => undefined };
    let n = 0;
    const handler = async () => (++n === 1 ? new Response("x", { status: 503 }) : Response.json({ ok: true }, { status: 201 }));
    expect((await withRiver(post("{}", "idem-key-0200"), { scope: "orders:write", write: true }, handler, deps)).status).toBe(503);
    expect((await withRiver(post("{}", "idem-key-0200"), { scope: "orders:write", write: true }, handler, deps)).status).toBe(201);
  });
});

describe("Google OIDC token check", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const keys = keySetFromJwks({ keys: [{ ...publicKey.export({ format: "jwk" }), kid: "k1" }] });
  const mint = (claims: Record<string, unknown>, kid = "k1") => {
    const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const head = enc({ alg: "RS256", kid, typ: "JWT" }), body = enc(claims);
    const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(privateKey).toString("base64url");
    return `${head}.${body}.${sig}`;
  };
  const now = Date.now();
  const good = { iss: "https://accounts.google.com", aud: DEV_ORIGIN, email: BRIDGE_SERVICE_ACCOUNT_DEV, email_verified: true, iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + 3600 };

  it("TC-RB-OIDC-01 a Google-signed token for the dev origin passes", () => {
    expect(verifyGoogleIdToken(mint(good), DEV_ORIGIN, keys, now)).toEqual({ email: BRIDGE_SERVICE_ACCOUNT_DEV, audience: DEV_ORIGIN });
  });
  it("TC-RB-OIDC-02 prod audience, wrong issuer, expired, unverified email, unknown kid or bad signature fail", () => {
    for (const aud of PROD_AUDIENCES) expect(() => verifyGoogleIdToken(mint({ ...good, aud }), DEV_ORIGIN, keys, now)).toThrow();
    expect(() => verifyGoogleIdToken(mint({ ...good, iss: "https://evil.example" }), DEV_ORIGIN, keys, now)).toThrow();
    expect(() => verifyGoogleIdToken(mint({ ...good, exp: Math.floor(now / 1000) - 600 }), DEV_ORIGIN, keys, now)).toThrow();
    expect(() => verifyGoogleIdToken(mint({ ...good, email_verified: false }), DEV_ORIGIN, keys, now)).toThrow();
    expect(() => verifyGoogleIdToken(mint(good, "k2"), DEV_ORIGIN, keys, now)).toThrow("oidc_kid");
    const t = mint(good);
    expect(() => verifyGoogleIdToken(t.slice(0, -4) + "AAAA", DEV_ORIGIN, keys, now)).toThrow();
  });
});

describe("dev-only gating (fail closed on prod)", () => {
  const dev = { BARBERS_ENV: "dev", FIRESTORE_DATABASE_ID: "barbersdb-dev", NODE_ENV: "production", RIVER_BRIDGE_REQUEST_SECRET_V1: S1, RIVER_BRIDGE_WEBHOOK_SECRET_V1: "w1-test", RIVER_WEBHOOKS_ENABLED: "1" };
  it("TC-RB-CFG-01 dev with secrets is on, audience is the dev origin and never a prod URL", () => {
    const c = partnerConfig(dev);
    expect(c.ok).toBe(true);
    if (c.ok) {
      expect(c.audience).toBe(DEV_ORIGIN);
      expect((PROD_AUDIENCES as readonly string[]).includes(c.audience)).toBe(false);
      expect(c.allowedEmails).toEqual([BRIDGE_SERVICE_ACCOUNT_DEV]);
      expect(c.secrets.map((s) => s.keyId)).toEqual(["bridge-to-barbers-dev-v1"]);
      expect(c.requireHttps).toBe(true);
    }
  });
  it("TC-RB-CFG-02 prod stage, prod database or no secrets → not configured (old shared key is never read)", () => {
    expect(partnerConfig({ ...dev, BARBERS_ENV: "prod", FIRESTORE_DATABASE_ID: "barbersdb" }).ok).toBe(false);
    expect(partnerConfig({ ...dev, FIRESTORE_DATABASE_ID: "barbersdb" }).ok).toBe(false);
    expect(partnerConfig({ ...dev, RIVER_BRIDGE_REQUEST_SECRET_V1: "", RIVER_MOBILE_API_KEY: "rk_old" }).ok).toBe(false);
  });
  it("TC-RB-CFG-03 the dev-key fallback never turns on in a production build", () => {
    const c = partnerConfig({ ...dev, RIVER_DEV_API_KEY: "local-dev-key-123456" });
    expect(c.ok && c.allowKeyFallback).toBe(false);
    const local = partnerConfig({ ...dev, NODE_ENV: "development", RIVER_DEV_API_KEY: "local-dev-key-123456" });
    expect(local.ok && local.allowKeyFallback).toBe(true);
  });
  it("TC-RB-CFG-04 webhooks only on dev, only when enabled, with the webhook-direction key", () => {
    const w = webhookConfig(dev);
    expect(w).toMatchObject({ ok: true, keyId: "barbers-to-bridge-dev-v1", url: "https://asia-southeast1-rivermobile-ph.cloudfunctions.net/bridge/hooks/barbers", audience: "https://asia-southeast1-rivermobile-ph.cloudfunctions.net/bridge/hooks/barbers" });
    expect(webhookConfig({ ...dev, BARBERS_ENV: "prod", FIRESTORE_DATABASE_ID: "barbersdb" }).ok).toBe(false);
    expect(webhookConfig({ ...dev, RIVER_WEBHOOKS_ENABLED: "0" }).ok).toBe(false);
    expect(webhookConfig({ ...dev, RIVER_BRIDGE_WEBHOOK_SECRET_V1: "" }).ok).toBe(false);
  });
});
