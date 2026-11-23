import "server-only";
// Copied from idealchop/River-Mobile-App bridge-kit (PR #3, commit aa192e8ca9e4cade7b17ab3354e2af2466e5db95). Keep the signing logic identical.
import { randomUUID } from 'node:crypto';
import { canonicalString } from "./canonical";
import { macHex } from "./canonical";

export interface SignInput {
  method: string;
  pathWithQuery: string;
  body?: string | Buffer;
  keyId: string;
  secret: string;
  now?: Date;
  nonce?: string;
  /** Factor 1: `Bearer <OIDC ID token>` or, dev/emulator only, `Bearer <api key>`. */
  authorization: string;
  idempotencyKey?: string;
}

export interface SignedRequest {
  timestamp: string;
  nonce: string;
  canonical: string;
  headers: Record<string, string>;
}

/** Headers for one Bridge → app (or app → Bridge webhook) call. HMAC is always applied. */
export function signRequest(input: SignInput): SignedRequest {
  const timestamp = Math.floor((input.now ?? new Date()).getTime() / 1000).toString();
  const nonce = input.nonce ?? randomUUID();
  const canonical = canonicalString({
    method: input.method,
    pathWithQuery: input.pathWithQuery,
    timestamp,
    nonce,
    body: input.body ?? '',
  });
  const headers: Record<string, string> = {
    Authorization: input.authorization,
    'Content-Type': 'application/json',
    'X-River-Key-Id': input.keyId,
    'X-River-Timestamp': timestamp,
    'X-River-Nonce': nonce,
    'X-River-Signature': `v1=${macHex(input.secret, canonical)}`,
  };
  if (input.idempotencyKey) headers['Idempotency-Key'] = input.idempotencyKey;
  return { timestamp, nonce, canonical, headers };
}
