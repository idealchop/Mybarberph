"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/cloud";
import { useSession } from "@/lib/session";
import { cached, fetchShared, invalidate } from "@/lib/swr";

export interface UnclaimedRow { barberId: string; barberName: string; locationId: string; amount: number; count: number; oldest: number }
export interface ClaimRow { id: string; barberId: string; barberName: string; locationId: string; amount: number; count: number; from: number; to: number; claimedAt: number; claimedBy: string; bookingIds?: string[] }
export interface Remit { unclaimed: UnclaimedRow[]; total: number; claims: ClaimRow[] }

/** Unclaimed barber cash + claims for a scope; claim() marks a barber's remit received. */
export function useRemit(loc: string) {
  const { user } = useSession();
  // Data is tagged with its location so a switch never shows the previous location's figures.
  const [state, setState] = useState<{ loc: string; d: Remit } | null>(() => { const c = cached<Remit>(`remit:${loc}`); return c ? { loc, d: c } : null; });
  const data: Remit | null = state?.loc === loc ? state.d : cached<Remit>(`remit:${loc}`) ?? null;
  const setData = useCallback((d: Remit) => setState({ loc, d }), [loc]);
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState("");
  const load = useCallback((maxAge = 0) => fetchShared(`remit:${loc}`, () => api(`/api/shop/remit-claims?loc=${encodeURIComponent(loc)}`) as Promise<Remit>, maxAge).then((d) => setData(d)), [loc, setData]);
  useEffect(() => {
    if (!user) return;
    let tries = 0;
    const get = () => load(10_000).catch(() => { if (tries++ < 2) window.setTimeout(get, 1200); });
    void get();
    const t = window.setInterval(() => { if (document.visibilityState === "visible") void load().catch(() => undefined); }, 30_000);
    return () => window.clearInterval(t);
  }, [user, load]);
  const claim = async (barberId: string, locationId: string) => {
    const key = `${barberId}@${locationId}`;
    if (busy) return;
    setBusy(key); setError("");
    try {
      await api("/api/shop/remit-claims", { method: "POST", body: JSON.stringify({ barberId, locationId }) });
      invalidate("remit:");
      await load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  };
  /** bookingId → the claim that covered it (claimed cash stays in every total; only the outstanding figure drops). */
  const claimOf = useMemo(() => {
    const m = new Map<string, ClaimRow>();
    for (const c of data?.claims ?? []) for (const id of c.bookingIds ?? []) m.set(id, c);
    return (bookingId: string) => m.get(bookingId);
  }, [data]);
  return { data, loading: Boolean(user) && !data, claim, busy, error, claimOf };
}
