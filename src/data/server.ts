import "server-only";

/**
 * Server-only data access (Admin SDK). Never import this from client components.
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
  const { adminDb } = await import("@/lib/firebase/admin");
  const { FirestoreBarbersRepository } = await import("./firebase/repository");
  const { redirect } = await import("next/navigation");
  const ctx = await getSessionContext();
  if (!ctx) {
    redirect("/");
    throw new Error("unreachable");
  }
  return new FirestoreBarbersRepository(adminDb(), ctx.shopId);
}
