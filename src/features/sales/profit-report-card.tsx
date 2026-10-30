"use client";

import { useNow } from "@/lib/use-now";
import { useChairRequests } from "@/lib/chair-bookings";
import { peso } from "@/lib/format";
import { HOME_LOCATION_ID, useShopLocations } from "@/lib/shop-locations";
import { useShopChairs } from "@/lib/shop-chairs";
import { useShopProfile } from "@/lib/shop-profile";
import { compactPeso, profitWeek } from "@/lib/profit-report";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useSalesRows } from "./use-sales-rows";
import { mergeLiveRows } from "@/lib/cut-count";
import { cn } from "@river-apps/ui";
import { claimStates, cellClaimState } from "@/lib/profit-claim";
import { useRemit } from "./use-remit";

const cell = (n: number) => (n ? compactPeso(n) : "–");
const todayKey = (now: number) => new Date(now + 8 * 3600_000).toISOString().slice(0, 10);

/** Home preview of this week’s profit report. The whole card opens the full grid. */
export function ProfitReportCard({ className = "" }: { className?: string }) {
  const shops = useShopLocations();
  const { profile } = useShopProfile();
  const { chairs } = useShopChairs({ all: true });
  const deep = useSalesRows(70);
  const cloud = useChairRequests();
  const rows = useMemo(() => mergeLiveRows(deep, cloud.rows), [deep, cloud.rows]);
  const branches = useMemo(
    () => (shops.enabled ? shops.branches : [{ id: HOME_LOCATION_ID, name: profile.name || "Main" }]),
    [shops.enabled, shops.branches, profile.name],
  );
  const where = shops.viewingAll || !shops.enabled ? "all" : shops.scopeId ?? "all";
  const now = useNow();
  const report = profitWeek(rows, chairs, where, 0, now, branches);
  const remit = useRemit("all");
  // Same claim colors as the profit grid: red = cash still to claim that day, green = all claimed, neutral otherwise.
  const claimMap = useMemo(() => (remit.data ? claimStates(rows, chairs, (id) => Boolean(remit.claimOf(id))) : null), [rows, chairs, remit]);
  const dayState = (day: string) => {
    if (!claimMap) return null;
    let open = 0, claimed = 0;
    for (const [k, v] of claimMap) {
      if (!k.endsWith(`|${day}`)) continue;
      const loc = k.slice(k.indexOf("@") + 1, k.indexOf("|"));
      if (where !== "all" && loc !== where) continue;
      open += v.open; claimed += v.claimed;
    }
    return cellClaimState({ open, claimed });
  };
  const tk = todayKey(now);
  return (
    <Link href="/sales/profit" aria-label="Open the weekly profit report" className={`block rounded-card bg-surface px-4 pb-4 pt-3.5 shadow-card active:scale-[0.99] ${className}`}>
      <span className="flex items-center gap-2">
        <span className="min-w-0 flex-1">
          <b className="block text-[16px] tracking-[-0.01em]">Your weekly profit</b>
          <span className="mt-0.5 block truncate text-[12.5px] font-semibold text-muted">{report.label}</span>
        </span>
        <span className="flex-none text-right">
          <b className="block text-[22px] font-extrabold leading-none tracking-[-0.02em] tabular-nums">{peso(report.total)}</b>
          <small className="text-[11px] font-semibold text-muted">your share</small>
        </span>
        <span aria-hidden className="inline-flex size-8 flex-none items-center justify-center rounded-full bg-grey-100 text-ink"><ChevronRight size={16} strokeWidth={2.4} /></span>
      </span>
      <span className="mt-3 grid grid-cols-7 gap-1" aria-hidden>
        {report.days.map((d, i) => {
          const today = d.key === tk;
          const future = d.key > tk;
          const n = report.daily[i] ?? 0;
          const st = future || !n ? null : dayState(d.key);
          return (
            <span key={d.key} className={cn("flex min-w-0 flex-col items-center rounded-[12px] py-2", today ? "bg-ink text-on-ink" : "bg-grey-50")}>
              <span className={cn("text-[11.5px] font-bold", today ? "text-on-ink-muted" : "text-muted")}>{d.dow}</span>
              <span className={cn("mt-1 whitespace-nowrap text-[13px] font-extrabold leading-none tabular-nums",
                future && "opacity-35",
                st === "open" && (today ? "text-[#FF8A80]" : "text-[#C62828]"),
                st === "claimed" && (today ? "text-[#7BE0A6]" : "text-[#0B7A3E]"))}>{future ? "–" : cell(n)}</span>
              <i className={cn("mt-1.5 block size-1.5 rounded-full", st === "open" ? "bg-[#C62828]" : st === "claimed" ? "bg-[#0B7A3E]" : "bg-transparent")} />
            </span>
          );
        })}
      </span>
    </Link>
  );
}
