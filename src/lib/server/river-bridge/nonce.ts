import "server-only";
// Copied from idealchop/River-Mobile-App bridge-kit (PR #3, commit aa192e8ca9e4cade7b17ab3354e2af2466e5db95). Keep the signing logic identical.
/** Single-use nonce per key id. TTL is 10 minutes (the ±5 min window plus slack). */

export const NONCE_TTL_MS = 10 * 60 * 1000;
export const TIMESTAMP_WINDOW_SECONDS = 5 * 60;

export interface NonceStore {
  /** `create()`-style: the second claim of the same pair returns `replay`. */
  claim(keyId: string, nonce: string, now: Date): Promise<'ok' | 'replay'>;
}

export class MemoryNonceStore implements NonceStore {
  private readonly seen = new Map<string, number>();

  constructor(private readonly ttlMs = NONCE_TTL_MS) {}

  async claim(keyId: string, nonce: string, now: Date): Promise<'ok' | 'replay'> {
    const time = now.getTime();
    for (const [key, expiry] of this.seen) {
      if (expiry <= time) this.seen.delete(key);
    }
    const id = `${keyId}\n${nonce}`;
    if (this.seen.has(id)) return 'replay';
    this.seen.set(id, time + this.ttlMs);
    return 'ok';
  }
}

export const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidV4(value: string): boolean {
  return UUID_V4.test(value);
}
