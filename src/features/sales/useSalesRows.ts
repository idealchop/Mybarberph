"use client";
import { useEffect, useState } from "react";
import type { ChairRequest } from "@/lib/chair-bookings";
import { api } from "@/lib/cloud";
import { useSession } from "@/lib/session";

/** Last 28 Manila days of visits for Sales (refreshes every 30s). */
export function useSalesRows(days = 28, full = false) {
  const { user } = useSession();
  const [rows, setRows] = useState<ChairRequest[] | null>(null);
  useEffect(() => {
    if (!user) return;
    let live = true, tries = 0;
    const get = () => api(`/api/shop/sales-rows?days=${days}${full ? "&full=1" : ""}`).then((d: { rows: ChairRequest[] }) => { if (live) setRows(d.rows); })
      .catch(() => { if (live && tries++ < 3) window.setTimeout(get, 1200); });
    void get();
    const t = window.setInterval(get, 30_000);
    return () => { live = false; window.clearInterval(t); };
  }, [user, days, full]);
  return rows;
}
