import "server-only";

/**
 * Server-only data access (Admin SDK). Never import this from client components.
 *
 * Guests (no session cookie) get in-memory demo data so Paid screens can be
 * browsed without signing in. Mutations still hit /api/repo which requires auth.
 */
import type { BarbersRepository } from "./repository";
import { MockBarbersRepository } from "./mock/repository";

let mockInstance: MockBarbersRepository | undefined;

export async function getServerRepository(): Promise<BarbersRepository> {
  const source = process.env.NEXT_PUBLIC_DATA_SOURCE ?? "mock";
  if (source !== "firebase") {
    mockInstance ??= new MockBarbersRepository();
    return mockInstance;
  }
  const { getSessionContext } = await import("@/lib/firebase/session");
  const ctx = await getSessionContext();
  if (!ctx) {
    mockInstance ??= new MockBarbersRepository();
    return mockInstance;
  }
  const { adminDb } = await import("@/lib/firebase/admin");
  const { FirestoreBarbersRepository } = await import("./firebase/repository");
  return new FirestoreBarbersRepository(adminDb(), ctx.shopId);
}

export async function isGuestSession(): Promise<boolean> {
  if ((process.env.NEXT_PUBLIC_DATA_SOURCE ?? "mock") !== "firebase") return false;
  const { getSessionContext } = await import("@/lib/firebase/session");
  return !(await getSessionContext());
}
