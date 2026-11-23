import "server-only";
import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { NONCE_TTL_MS, type NonceStore } from "./nonce";

/**
 * Server-only Firestore stores on the configured database (barbersdb-dev on dev). The rules catch-all
 * denies clients. `expireAt` is the TTL field: enable a TTL policy on barbersdb-dev for
 * riverNonces.expireAt and riverIdempotency.expireAt (docs/river-mobile-api.md → Ops). Until then the
 * docs simply stay; correctness does not depend on deletion (nonces are checked by create()).
 */
export const NONCE_COLLECTION = "riverNonces";
export const IDEMPOTENCY_COLLECTION = "riverIdempotency";
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

const hashId = (...parts: string[]) => createHash("sha256").update(parts.join("\n")).digest("hex");
const alreadyExists = (e: unknown) => {
  const code = (e as { code?: unknown })?.code;
  return code === 6 || code === "already-exists" || /ALREADY_EXISTS/i.test(String((e as Error)?.message ?? ""));
};

/** create() so a second claim of the same key id + nonce fails: single use within the TTL. */
export class FirestoreNonceStore implements NonceStore {
  async claim(keyId: string, nonce: string, now: Date): Promise<"ok" | "replay"> {
    const ref = adminDb().collection(NONCE_COLLECTION).doc(hashId(keyId, nonce));
    try {
      await ref.create({ keyId, at: now.getTime(), expireAt: Timestamp.fromMillis(now.getTime() + NONCE_TTL_MS) });
      return "ok";
    } catch (e) {
      if (alreadyExists(e)) return "replay";
      throw e;
    }
  }
}

export interface IdemRecord { bodyHash: string; state: "pending" | "done"; status?: number; contentType?: string; body?: string }
export interface IdemStore {
  /** First writer wins. */
  reserve(id: string, bodyHash: string, now: number): Promise<"created" | "exists">;
  get(id: string): Promise<IdemRecord | null>;
  complete(id: string, res: { status: number; contentType: string; body: string }): Promise<void>;
  release(id: string): Promise<void>;
}

export const idempotencyId = (caller: string, method: string, path: string, key: string) => hashId(caller, method.toUpperCase(), path, key);

export class FirestoreIdemStore implements IdemStore {
  private col() { return adminDb().collection(IDEMPOTENCY_COLLECTION); }
  async reserve(id: string, bodyHash: string, now: number) {
    try {
      await this.col().doc(id).create({ bodyHash, state: "pending", createdAt: now, expireAt: Timestamp.fromMillis(now + IDEMPOTENCY_TTL_MS) });
      return "created" as const;
    } catch (e) {
      if (alreadyExists(e)) return "exists" as const;
      throw e;
    }
  }
  async get(id: string) { return ((await this.col().doc(id).get()).data() as IdemRecord | undefined) ?? null; }
  async complete(id: string, res: { status: number; contentType: string; body: string }) {
    await this.col().doc(id).set({ state: "done", ...res }, { merge: true });
  }
  async release(id: string) { await this.col().doc(id).delete(); }
}
