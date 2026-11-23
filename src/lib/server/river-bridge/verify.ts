import "server-only";
// Copied from idealchop/River-Mobile-App bridge-kit (PR #3, commit aa192e8ca9e4cade7b17ab3354e2af2466e5db95). Check order and generic failures are the kit's.
import { apiKeyMatches, canonicalString, macHex, signaturesMatch } from "./canonical";
import { isUuidV4, TIMESTAMP_WINDOW_SECONDS, type NonceStore } from "./nonce";

export const AUTH_HEADER = 'authorization';

export interface ActiveSecret {
  keyId: string;
  /** HMAC secret for this key id. Never log it. */
  secret: string;
}

export interface OidcIdentity {
  email: string;
  audience: string;
}

export interface OidcVerifier {
  verify(idToken: string, audience: string): Promise<OidcIdentity>;
}

export interface VerifyInput {
  method: string;
  pathWithQuery: string;
  headers: Record<string, string | string[] | undefined>;
  rawBody?: Buffer | string;
  /** True when the request arrived on HTTPS (or x-forwarded-proto is https). */
  secure: boolean;
}

export interface AuthAudit {
  at: string;
  method: string;
  path: string;
  keyId?: string;
  caller?: string;
  result: 'allow' | 'deny';
  status: number;
  /** Server-side only. Never copy this into the HTTP body. */
  reason: string;
}

export interface VerifyOptions {
  /** Expected OIDC audience. Webhooks: `{bridge}/hooks/{app}`. App APIs: the partner base URL. */
  audience: string;
  secrets: ActiveSecret[];
  /** Service-account emails allowed to call. A token for anyone else is 401. */
  allowedEmails: string[];
  oidc: OidcVerifier;
  nonces: NonceStore;
  /**
   * Dev and emulator only. When true, a non-JWT bearer is checked by hash
   * against `devApiKey`. Production leaves this false: HMAC has no fallback,
   * and factor 1 must be a Google OIDC token.
   */
  allowKeyFallback: boolean;
  devApiKey?: string;
  requireHttps: boolean;
  /** Scopes granted to this caller. Checked only when `requiredScope` is set. */
  grantedScopes?: string[];
  requiredScope?: string;
  now?: Date;
  onAudit?: (entry: AuthAudit) => void;
}

export type VerifyResult =
  | { ok: true; keyId: string; caller: string; factor: 'oidc' | 'key' }
  | { ok: false; status: 401 | 403; code: 'unauthorized' | 'forbidden'; reason: string };

export function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const direct = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(direct)) return direct[0];
  if (typeof direct === 'string') return direct;
  const found = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  if (!found) return undefined;
  return Array.isArray(found[1]) ? found[1][0] : found[1];
}

function looksLikeJwt(token: string): boolean {
  const parts = token.split('.');
  return parts.length === 3 && parts.every((part) => part.length > 0);
}

/**
 * Receiver checks, in order. Stops at the first failure.
 * TLS → OIDC (or dev key) → key id → timestamp → nonce → HMAC → scope.
 * The body hash is inside the HMAC input. The HTTP body for a failure is
 * built by the caller from `status` + `code` only.
 */
export async function verifyRequest(input: VerifyInput, options: VerifyOptions): Promise<VerifyResult> {
  const now = options.now ?? new Date();
  const method = input.method.toUpperCase();
  const path = input.pathWithQuery.split('?')[0] ?? input.pathWithQuery;
  // eslint-disable-next-line prefer-const -- assigned below; read earlier by finish() for the audit line (kit code).
  let keyId: string | undefined;
  let caller: string | undefined;

  const finish = (result: VerifyResult): VerifyResult => {
    options.onAudit?.({
      at: now.toISOString(),
      method,
      path,
      keyId,
      caller,
      result: result.ok ? 'allow' : 'deny',
      status: result.ok ? 200 : result.status,
      reason: result.ok ? 'ok' : result.reason,
    });
    return result;
  };

  if (options.requireHttps && !input.secure) {
    return finish({ ok: false, status: 401, code: 'unauthorized', reason: 'insecure_transport' });
  }

  const authorization = headerValue(input.headers, 'authorization') ?? '';
  const match = /^Bearer\s+(\S+)$/i.exec(authorization);
  if (!match) {
    return finish({ ok: false, status: 401, code: 'unauthorized', reason: 'missing_token' });
  }
  const token = match[1] ?? "";

  if (looksLikeJwt(token)) {
    try {
      const identity = await options.oidc.verify(token, options.audience);
      caller = identity.email;
      if (identity.audience !== options.audience) {
        return finish({ ok: false, status: 401, code: 'unauthorized', reason: 'bad_audience' });
      }
      if (!options.allowedEmails.includes(identity.email)) {
        return finish({ ok: false, status: 401, code: 'unauthorized', reason: 'caller_not_allowed' });
      }
    } catch {
      return finish({ ok: false, status: 401, code: 'unauthorized', reason: 'oidc_invalid' });
    }
  } else if (options.allowKeyFallback) {
    if (!options.devApiKey || !apiKeyMatches(token, options.devApiKey)) {
      return finish({ ok: false, status: 401, code: 'unauthorized', reason: 'bad_dev_key' });
    }
    caller = `dev-key`;
  } else {
    return finish({ ok: false, status: 401, code: 'unauthorized', reason: 'oidc_required' });
  }

  keyId = headerValue(input.headers, 'x-river-key-id');
  if (!keyId || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/.test(keyId)) {
    return finish({ ok: false, status: 401, code: 'unauthorized', reason: 'bad_key_id' });
  }
  const active = options.secrets.filter((item) => item.secret.length > 0);
  const selected = active.find((item) => item.keyId === keyId);
  if (!selected) {
    return finish({ ok: false, status: 401, code: 'unauthorized', reason: 'unknown_key_id' });
  }

  const timestamp = headerValue(input.headers, 'x-river-timestamp') ?? '';
  if (!/^\d{1,12}$/.test(timestamp)) {
    return finish({ ok: false, status: 401, code: 'unauthorized', reason: 'bad_timestamp' });
  }
  const skew = Math.abs(Math.floor(now.getTime() / 1000) - Number(timestamp));
  if (skew > TIMESTAMP_WINDOW_SECONDS) {
    return finish({ ok: false, status: 401, code: 'unauthorized', reason: 'timestamp_window' });
  }

  const nonce = headerValue(input.headers, 'x-river-nonce') ?? '';
  if (!isUuidV4(nonce)) {
    return finish({ ok: false, status: 401, code: 'unauthorized', reason: 'bad_nonce' });
  }
  const claimed = await options.nonces.claim(selected.keyId, nonce, now);
  if (claimed === 'replay') {
    return finish({ ok: false, status: 401, code: 'unauthorized', reason: 'replayed_nonce' });
  }

  const canonical = canonicalString({
    method,
    pathWithQuery: input.pathWithQuery,
    timestamp,
    nonce,
    body: input.rawBody ?? '',
  });
  const signature = headerValue(input.headers, 'x-river-signature');
  // MAC every active secret so a wrong version does not return early.
  let accepted = false;
  for (const item of active) {
    const expected = macHex(item.secret, canonical);
    const matchSig = signaturesMatch([expected], signature);
    if (matchSig && item.keyId === selected.keyId) accepted = true;
  }
  if (!accepted) {
    return finish({ ok: false, status: 401, code: 'unauthorized', reason: 'bad_signature' });
  }

  if (options.requiredScope) {
    const granted = options.grantedScopes ?? [];
    if (!granted.includes(options.requiredScope)) {
      return finish({ ok: false, status: 403, code: 'forbidden', reason: 'missing_scope' });
    }
  }

  return finish({ ok: true, keyId: selected.keyId, caller: caller ?? 'unknown', factor: looksLikeJwt(token) ? 'oidc' : 'key' });
}
