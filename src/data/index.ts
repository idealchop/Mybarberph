/**
 * Single entry point for data access. UI code imports from "@/data" only.
 * Set NEXT_PUBLIC_DATA_SOURCE=firebase once a Firebase adapter exists (see ./firebase/README.md).
 */
import type { BarbersRepository } from "./repository";
import { MockBarbersRepository } from "./mock/repository";

export type * from "./types";
export type { BarbersRepository, Page, ScanResult, TransactionQuery } from "./repository";
export { DEMO_NOW } from "./mock/seed";

let instance: BarbersRepository | undefined;

export function getRepository(): BarbersRepository {
  if (!instance) {
    const source = process.env.NEXT_PUBLIC_DATA_SOURCE ?? "mock";
    if (source !== "mock") console.warn(`[barbers.ph] Data source "${source}" is not implemented yet; using mock data.`);
    instance = new MockBarbersRepository();
  }
  return instance;
}
