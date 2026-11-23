import "server-only";
// Copied from idealchop/River-Mobile-App bridge-kit (PR #3, commit aa192e8ca9e4cade7b17ab3354e2af2466e5db95). Keep the signing logic identical.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Canonical string covered by X-River-Signature.
 *
 *   v1\n
 *   METHOD\n
 *   PATH?SORTED_QUERY\n
 *   X-River-Timestamp\n
 *   X-River-Nonce\n
 *   hex(SHA-256(raw body bytes))
 *
 * Empty body hashes as SHA-256 of the empty string. Query keys are sorted
 * so both sides sign the same bytes regardless of parameter order.
 */
export function sha256Hex(body: string | Buffer | undefined): string {
  return createHash('sha256').update(body ?? '').digest('hex');
}

export function normalizePath(pathWithQuery: string): string {
  const qIndex = pathWithQuery.indexOf('?');
  const path = qIndex === -1 ? pathWithQuery : pathWithQuery.slice(0, qIndex);
  const query = qIndex === -1 ? '' : pathWithQuery.slice(qIndex + 1);
  if (!query) return path;
  const pairs: [string, string][] = [];
  for (const part of query.split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    const rawKey = eq === -1 ? part : part.slice(0, eq);
    const rawValue = eq === -1 ? '' : part.slice(eq + 1);
    pairs.push([decodeURIComponent(rawKey.replace(/\+/g, ' ')), decodeURIComponent(rawValue.replace(/\+/g, ' '))]);
  }
  pairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  const sorted = pairs.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&');
  return sorted ? `${path}?${sorted}` : path;
}

export function canonicalString(parts: {
  method: string;
  pathWithQuery: string;
  timestamp: string;
  nonce: string;
  body?: string | Buffer;
}): string {
  return [
    'v1',
    parts.method.toUpperCase(),
    normalizePath(parts.pathWithQuery),
    parts.timestamp,
    parts.nonce,
    sha256Hex(parts.body),
  ].join('\n');
}

/**
 * Constant-time compare of a `v1=<hex>` header against every expected MAC.
 * Always walks the full list. A length mismatch compares against a dummy
 * buffer so `timingSafeEqual` still runs.
 */
export function signaturesMatch(expectedHexList: string[], header: string | undefined): boolean {
  const raw = (header ?? '').startsWith('v1=') ? (header ?? '').slice(3) : '';
  const hexOk = /^[0-9a-f]{64}$/i.test(raw);
  const got = hexOk ? Buffer.from(raw, 'hex') : Buffer.alloc(32);
  let ok = false;
  const list = expectedHexList.length > 0 ? expectedHexList : ['00'.repeat(32)];
  for (const hex of list) {
    const wantOk = /^[0-9a-f]{64}$/i.test(hex);
    const want = wantOk ? Buffer.from(hex, 'hex') : Buffer.alloc(32);
    if (want.length === got.length) {
      if (timingSafeEqual(want, got) && hexOk && wantOk) ok = true;
    } else {
      timingSafeEqual(Buffer.alloc(got.length), got);
    }
  }
  return ok;
}

/** Factor 1 dev-key check: compare SHA-256 hashes, never the raw key. */
export function apiKeyMatches(presented: string, expected: string): boolean {
  const got = createHash('sha256').update(presented).digest();
  const want = createHash('sha256').update(expected).digest();
  return timingSafeEqual(got, want);
}

export function macHex(secret: string, canonical: string): string {
  return createHmac('sha256', secret).update(canonical).digest('hex');
}
