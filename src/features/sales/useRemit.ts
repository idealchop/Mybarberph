"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/cloud";
import { useSession } from "@/lib/session";

export interface UnclaimedRow { barberId: string; barberName: string; locationId: string; amount: number; count: number; oldest: number }
export interface ClaimRow { id: string; barberId: string; barberName: string; locationId: string; amount: number; count: number; from: number; to: number; claimedAt: number; claimedBy: string }
export interface Remit { unclaimed: UnclaimedRow[]; total: number; claims: ClaimRow[] }

/** Unclaimed barber cash + claims for a scope; claim() marks a barber's remit received. */
export function useRemit(loc: string) {
  const { user } = useSession();
  const [data, setData] = useState<Remit | null>(null);
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState("");
  const load = useCallback(() => api(`/api/shop/remit-claims?loc=${encodeURIComponent(loc)}`).then((d: Remit) => setData(d)).catch(() => undefined), [loc]);
  useEffect(() => {
    if (!user) return;
    let tries = 0;
    const get = () => load().catch(() => { if (tries++ < 2) window.setTimeout(get, 1200); });
    void get();
    const t = window.setInterval(get, 30_000);
    return () => window.clearInterval(t);
  }, [user, load]);
  const claim = async (barberId: string, locationId: string) => {
    const key = `${barberId}@${locationId}`;
    if (busy) return;
    setBusy(key); setError("");
    try {
      await api("/api/shop/remit-claims", { method: "POST", body: JSON.stringify({ barberId, locationId }) });
      await load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  };
  return { data, claim, busy, error };
}
