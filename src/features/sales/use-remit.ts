"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/cloud";
import { useSession } from "@/lib/session";
import { cached, fetchShared, invalidate } from "@/lib/swr";
import { applyPendingClaim, PENDING_PREFIX, rollbackPendingClaim, type PendingClaim } from "@/lib/remit-optimistic";

/** Every mounted useRemit (Home, Weekly Profit Report, day sheet, barber pages) hears a claim at once (v1.0.30). */
type RemitEvent = { kind: "apply"; p: PendingClaim } | { kind: "rollback"; id: string } | { kind: "reload" };
const listeners = new Set<(e: RemitEvent) => void>();
const emit = (e: RemitEvent) => { for (const l of [...listeners]) l(e); };
let seq = 0;

export interface UnclaimedRow { barberId: string; barberName: string; locationId: string; amount: number; ownerShare?: number; count: number; oldest: number }
export interface ClaimRow { id: string; barberId: string; barberName: string; locationId: string; amount: number; count: number; from: number; to: number; claimedAt: number; claimedBy: string; bookingIds?: string[]; /** GCash visits an older cash-only claim covers by day (v1.0.25). */ coveredIds?: string[]; /** Optimistic claim not yet confirmed by the server (v1.0.30). */ pending?: boolean; ownerShare?: number; sharePct?: number | null; /** Adjusted claim (v1.0.34). */ expected?: number; received?: number; adjusted?: boolean; difference?: number }
export interface Remit { unclaimed: UnclaimedRow[]; total: number; ownerTotal?: number; claims: ClaimRow[] }

/** Unclaimed barber cash + claims for a scope; claim() marks a barber's remit received. */
export function useRemit(loc: string) {
  const { user } = useSession();
  // Data is tagged with its location so a switch never shows the previous location's figures.
  const [state, setState] = useState<{ loc: string; d: Remit } | null>(() => { const c = cached<Remit>(`remit:${loc}`); return c ? { loc, d: c } : null; });
  const data: Remit | null = state?.loc === loc ? state.d : cached<Remit>(`remit:${loc}`) ?? null;
  const setData = useCallback((d: Remit) => setState({ loc, d }), [loc]);
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState("");
  const clearError = useCallback(() => setError(""), []);
  const load = useCallback((maxAge = 0) => fetchShared(`remit:${loc}`, () => api(`/api/shop/remit-claims?loc=${encodeURIComponent(loc)}`) as Promise<Remit>, maxAge).then((d) => setData(d)), [loc, setData]);
  useEffect(() => {
    const snaps = new Map<string, Remit | null>();
    const on = (e: RemitEvent) => {
      if (e.kind === "reload") { void load().catch(() => undefined); return; }
      setState((s) => {
        const cur = s?.loc === loc ? s.d : cached<Remit>(`remit:${loc}`) ?? null;
        if (!cur) return s;
        if (e.kind === "apply") { snaps.set(e.p.id, cur); return { loc, d: applyPendingClaim(cur, e.p, loc) }; }
        const d = rollbackPendingClaim(cur, snaps.get(e.id) ?? null, e.id); snaps.delete(e.id);
        return { loc, d };
      });
    };
    listeners.add(on);
    return () => { listeners.delete(on); };
  }, [loc, load]);
  useEffect(() => {
    if (!user) return;
    let tries = 0;
    const get = () => load(10_000).catch(() => { if (tries++ < 2) window.setTimeout(get, 1200); });
    void get();
    const t = window.setInterval(() => { if (document.visibilityState === "visible") void load().catch(() => undefined); }, 30_000);
    return () => window.clearInterval(t);
  }, [user, load]);
  /** Claim: optimistic (green at once in every view), rolled back to red on failure, then every view refetches. */
  const claim = async (barberId: string, locationId: string, day?: string, bookingIds: string[] = [], adjust?: { expected: number; received: number }) => {
    const key = `${barberId}@${locationId}`;
    if (busy) return;
    setBusy(key); setError("");
    const id = `${PENDING_PREFIX}${Date.now()}-${++seq}`;
    emit({ kind: "apply", p: { id, barberId, locationId, bookingIds, day, at: Date.now(), ...(adjust ?? {}) } });
    try {
      await api("/api/shop/remit-claims", { method: "POST", body: JSON.stringify({ barberId, locationId, ...(day ? { day } : {}), ...(adjust && adjust.received !== adjust.expected ? { received: adjust.received } : {}) }) });
      invalidate("remit:"); invalidate("barber");
      emit({ kind: "reload" });
      await load().catch(() => undefined);
    } catch (e) {
      emit({ kind: "rollback", id });
      setError((e as Error).message || "Claim failed. Try again.");
    } finally { setBusy(""); }
  };
  /** bookingId → the claim that covered it (claimed cash stays in every total; only the outstanding figure drops). */
  const claimOf = useMemo(() => {
    const m = new Map<string, ClaimRow>();
    for (const c of data?.claims ?? []) for (const id of [...(c.bookingIds ?? []), ...(c.coveredIds ?? [])]) m.set(id, c);
    return (bookingId: string) => m.get(bookingId);
  }, [data]);
  return { data, loading: Boolean(user) && !data, claim, busy, error, clearError, claimOf };
}
