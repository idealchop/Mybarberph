/**
 * Client-safe data entry point. UI client features import from "@/data" only.
 * Server pages that need Firestore must use "@/data/server" → getServerRepository().
 *
 * NEXT_PUBLIC_DATA_SOURCE:
 *   - "mock" (default): in-memory demo data
 *   - "firebase": browser calls POST /api/repo (session cookie)
 */
import type { BarbersRepository } from "./repository";
import { MockBarbersRepository } from "./mock/repository";

export type * from "./types";
export type { BarbersRepository, Page, ScanResult, TransactionQuery } from "./repository";
export { DEMO_NOW } from "./mock/seed";

const source = () => process.env.NEXT_PUBLIC_DATA_SOURCE ?? "mock";

let mockInstance: MockBarbersRepository | undefined;
let clientInstance: BarbersRepository | undefined;

export function isFirebaseDataSource() {
  return source() === "firebase";
}

function createClientApiRepository(): BarbersRepository {
  const call = async <T,>(method: string, args: unknown[] = []): Promise<T> => {
    const res = await fetch("/api/repo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, args }),
    });
    const json = (await res.json().catch(() => ({}))) as { result?: T; error?: string };
    if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
    return json.result as T;
  };
  return new Proxy({} as BarbersRepository, {
    get(_t, prop: string | symbol) {
      if (prop === "then") return undefined;
      if (typeof prop !== "string") return undefined;
      return (...args: unknown[]) => call(prop, args);
    },
  });
}

/** Sync accessor used by client features (and mock mode everywhere). */
export function getRepository(): BarbersRepository {
  if (source() !== "firebase") {
    mockInstance ??= new MockBarbersRepository();
    return mockInstance;
  }
  if (typeof window === "undefined") {
    throw new Error('On the server with DATA_SOURCE=firebase, import getServerRepository from "@/data/server".');
  }
  clientInstance ??= createClientApiRepository();
  return clientInstance;
}
