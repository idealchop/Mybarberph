import "server-only";

/**
 * The ONLY way server code may put a limit on a bookings read (v1.0.24 guardrail, Boyet audit).
 * Reads cap + 1 docs; if the cap is hit it logs `[cap-hit]` (never silent) and returns the first `cap` docs with
 * `truncated: true`, so a caller that computes totals can refuse, warn, or tell the client.
 * - kind "total": the rows feed a count/sum. Hitting the cap is an ERROR (a total would undercount).
 * - kind "window": a deliberately recent slice (live list, newest N). Hitting the cap is expected; logged at debug.
 */
type Snap<D> = { docs: D[] };
type Limitable<D> = { limit: (n: number) => { get: () => Promise<Snap<D>> } };

export const capHits: { label: string; cap: number; kind: "total" | "window"; at: number }[] = [];

export async function cappedGet<D>(q: Limitable<D>, cap: number, label: string, kind: "total" | "window" = "total"): Promise<{ docs: D[]; truncated: boolean }> {
  const snap = await q.limit(cap + 1).get();
  const truncated = snap.docs.length > cap;
  if (truncated) {
    capHits.push({ label, cap, kind, at: Date.now() });
    if (capHits.length > 200) capHits.shift();
    if (kind === "total") console.error(`[cap-hit] ${label}: more than ${cap} rows; totals from this read would undercount`);
    else if (process.env.CAP_DEBUG) console.debug(`[cap-hit:window] ${label}: newest ${cap} kept`);
  }
  return { docs: truncated ? snap.docs.slice(0, cap) : snap.docs, truncated };
}
