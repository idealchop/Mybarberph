"use client";
import { useEffect, useState } from "react";
import type { ChairRequest } from "@/lib/chair-bookings";
import { api } from "@/lib/cloud";
import { useSession } from "@/lib/session";
import { cached, fetchShared } from "@/lib/swr";
import { noteEarliest } from "@/lib/sales-report";

/** Last N Manila days of visits for Sales (shared across screens, refreshes every 30s while visible). */
export function useSalesRows(days = 28, full = false, enabled = true) {
  const { user } = useSession();
  const key = `sales-rows:${days}:${full ? 1 : 0}`;
  const [rows, setRows] = useState<ChairRequest[] | null>(() => { const c = cached<ChairRequest[]>(key); if (c) noteEarliest(c); return c ?? null; });
  useEffect(() => {
    if (!user || !enabled) return;
    let live = true, tries = 0;
    const get = (maxAge = 0) => fetchShared(key, () => api(`/api/shop/sales-rows?days=${days}${full ? "&full=1" : ""}`).then((d: { rows: ChairRequest[] }) => d.rows), maxAge)
      .then((r) => { noteEarliest(r); if (live) setRows(r); })
      .catch(() => { if (live && tries++ < 3) window.setTimeout(() => get(), 1200); });
    void get(10_000);
    const t = window.setInterval(() => { if (document.visibilityState === "visible") void get(); }, 30_000);
    return () => { live = false; window.clearInterval(t); };
  }, [user, key, days, full, enabled]);
  return enabled ? rows : null;
}
