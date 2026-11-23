import "server-only";
// Copied from idealchop/River-Mobile-App bridge-kit (PR #3, commit aa192e8ca9e4cade7b17ab3354e2af2466e5db95). Storage is stores.ts (Firestore).
import { sha256Hex } from "./canonical";
import { problem } from "./problems";

export const IDEMPOTENCY_KEY = /^[A-Za-z0-9_.:-]{8,128}$/;

export interface StoredResponse {
  bodyHash: string;
  status: number;
  contentType: string;
  body: string;
}

export interface IdempotencyStore {
  get(id: string): Promise<StoredResponse | null>;
  /** First writer wins. `exists` means another request already stored this key. */
  create(id: string, value: StoredResponse): Promise<'created' | 'exists'>;
}

export class MemoryIdempotencyStore implements IdempotencyStore {
  private readonly rows = new Map<string, StoredResponse>();

  async get(id: string): Promise<StoredResponse | null> {
    return this.rows.get(id) ?? null;
  }

  async create(id: string, value: StoredResponse): Promise<'created' | 'exists'> {
    if (this.rows.has(id)) return 'exists';
    this.rows.set(id, value);
    return 'created';
  }
}

export function isIdempotencyKey(value: string | undefined): value is string {
  return typeof value === 'string' && IDEMPOTENCY_KEY.test(value);
}

export function idempotencyBodyHash(rawBody: Buffer | string | undefined): string {
  return sha256Hex(rawBody ?? '');
}

export { problem };
