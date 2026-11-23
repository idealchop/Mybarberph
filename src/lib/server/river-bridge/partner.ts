import "server-only";
import { randomUUID } from "node:crypto";
import { isIdempotencyKey, idempotencyBodyHash } from "./idempotency";
import { problem } from "./problems";
import { scopesFor, partnerConfig, type PartnerConfig, type Scope } from "./config";
import { verifyRequest, headerValue, type AuthAudit, type OidcVerifier } from "./verify";
import type { NonceStore } from "./nonce";
import { idempotencyId, type IdemStore } from "./stores";

/** 16 KB max request body (contract). */
export const MAX_BODY_BYTES = 16 * 1024;

export interface RiverCtx { caller: string; keyId: string; requestId: string; rawBody: string; body: unknown }
export interface RiverDeps { config?: PartnerConfig; oidc?: OidcVerifier; nonces?: NonceStore; idem?: IdemStore; now?: Date; log?: (line: Record<string, unknown>) => void }

export function problemResponse(status: number, code: string, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(problem(status, code)), { status, headers: { "content-type": "application/problem+json", "cache-control": "no-store", ...headers } });
}

const defaultLog = (line: Record<string, unknown>) => console.info(JSON.stringify(line));

async function defaults(deps: RiverDeps) {
  const [{ googleOidcVerifier }, stores] = await Promise.all([import("./google-oidc"), import("./stores")]);
  return {
    config: deps.config ?? partnerConfig(),
    oidc: deps.oidc ?? googleOidcVerifier(),
    nonces: deps.nonces ?? new stores.FirestoreNonceStore(),
    idem: deps.idem ?? new stores.FirestoreIdemStore(),
  };
}

/**
 * Every /api/river/v1 call except health: TLS → OIDC → key id → timestamp → nonce → body hash + HMAC
 * (bridge-kit verifyRequest) → scope → Idempotency-Key on writes. Stops at the first failure with a
 * generic problem+json. Each attempt writes one audit line (Cloud Logging, server-side): no secrets,
 * tokens or bodies.
 */
export async function withRiver(req: Request, opts: { scope: Scope; write?: boolean }, handler: (ctx: RiverCtx) => Promise<Response>, deps: RiverDeps = {}): Promise<Response> {
  const requestId = randomUUID();
  const log = deps.log ?? defaultLog;
  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  const audit = (a: Partial<AuthAudit> & { result: "allow" | "deny"; status: number; reason: string }) =>
    log({ severity: a.result === "allow" ? "INFO" : "WARNING", type: "river_partner_audit", requestId, at: (deps.now ?? new Date()).toISOString(), method, path: url.pathname, scope: opts.scope, ...a });

  const { config, oidc, nonces, idem } = await defaults(deps);
  if (!config.ok) {
    audit({ result: "deny", status: 503, reason: `not_configured:${config.reason}` });
    return problemResponse(503, "not_configured");
  }

  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MAX_BODY_BYTES) {
    audit({ result: "deny", status: 413, reason: "body_too_large" });
    return problemResponse(413, "payload_too_large");
  }
  const rawBody = method === "GET" || method === "HEAD" ? "" : await req.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    audit({ result: "deny", status: 413, reason: "body_too_large" });
    return problemResponse(413, "payload_too_large");
  }

  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
  const proto = (headers["x-forwarded-proto"] || "").split(",")[0]?.trim();
  const secure = url.protocol === "https:" || proto === "https";

  let entry: AuthAudit | undefined;
  let result;
  try {
    result = await verifyRequest(
      { method, pathWithQuery: url.pathname + url.search, headers, rawBody, secure },
      { audience: config.audience, secrets: config.secrets, allowedEmails: config.allowedEmails, oidc, nonces, allowKeyFallback: config.allowKeyFallback, devApiKey: config.devApiKey, requireHttps: config.requireHttps, now: deps.now, onAudit: (e) => { entry = e; } },
    );
  } catch {
    audit({ result: "deny", status: 503, reason: "verifier_error" });
    return problemResponse(503, "unavailable");
  }
  if (!result.ok) {
    audit({ result: "deny", status: result.status, reason: result.reason, keyId: entry?.keyId, caller: entry?.caller });
    return problemResponse(result.status, result.code);
  }
  const { caller, keyId } = result;
  if (!scopesFor(caller, result.factor === "key").includes(opts.scope)) {
    audit({ result: "deny", status: 403, reason: "missing_scope", keyId, caller });
    return problemResponse(403, "forbidden");
  }

  let body: unknown = null;
  if (rawBody.trim()) {
    try { body = JSON.parse(rawBody); } catch {
      audit({ result: "deny", status: 400, reason: "bad_json", keyId, caller });
      return problemResponse(400, "invalid_request");
    }
  }
  const ctx: RiverCtx = { caller, keyId, requestId, rawBody, body };

  if (!opts.write) {
    const res = await handler(ctx);
    audit({ result: "allow", status: res.status, reason: "ok", keyId, caller });
    return res;
  }

  const key = headerValue(headers, "idempotency-key");
  if (!isIdempotencyKey(key)) {
    audit({ result: "deny", status: 400, reason: "bad_idempotency_key", keyId, caller });
    return problemResponse(400, "invalid_request");
  }
  const id = idempotencyId(caller, method, url.pathname, key);
  const bodyHash = idempotencyBodyHash(rawBody);
  const now = (deps.now ?? new Date()).getTime();
  if ((await idem.reserve(id, bodyHash, now)) === "exists") {
    const prev = await idem.get(id);
    if (prev && prev.bodyHash !== bodyHash) {
      audit({ result: "deny", status: 422, reason: "idempotency_key_reused", keyId, caller });
      return problemResponse(422, "idempotency_key_reused");
    }
    if (prev?.state === "done" && typeof prev.status === "number") {
      audit({ result: "allow", status: prev.status, reason: "idempotent_replay", keyId, caller });
      return new Response(prev.body ?? "", { status: prev.status, headers: { "content-type": prev.contentType || "application/json", "cache-control": "no-store", "idempotent-replayed": "true" } });
    }
    audit({ result: "deny", status: 409, reason: "idempotency_in_progress", keyId, caller });
    return problemResponse(409, "conflict");
  }
  let res: Response;
  try {
    res = await handler(ctx);
  } catch (e) {
    await idem.release(id).catch(() => undefined);
    audit({ result: "allow", status: 500, reason: "handler_error", keyId, caller });
    throw e;
  }
  audit({ result: "allow", status: res.status, reason: "ok", keyId, caller });
  const text = await res.clone().text();
  // Server errors are not remembered, so the caller can retry with the same key.
  if (res.status >= 500) await idem.release(id).catch(() => undefined);
  else await idem.complete(id, { status: res.status, contentType: res.headers.get("content-type") || "application/json", body: text });
  return res;
}
