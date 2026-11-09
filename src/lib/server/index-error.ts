import "server-only";

/** Firestore's missing-composite-index error. The query then uses the previous, wider read. */
export function indexMissing(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /requires an index|FAILED_PRECONDITION/i.test(msg);
}
