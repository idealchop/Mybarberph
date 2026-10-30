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
  const dayAgg = (day: string) => {
    let open = 0, claimed = 0, owed = 0;
    if (claimMap) for (const [k, v] of claimMap) {
      if (!k.endsWith(`|${day}`)) continue;
      const loc = k.slice(k.indexOf("@") + 1, k.indexOf("|"));
      if (where !== "all" && loc !== where) continue;
      open += v.open; claimed += v.claimed; owed += v.openOwner;
    }
    return { open, claimed, owed };
  };
  const tk = todayKey(now);
  const cells = report.days.map((d, i) => {
    const n = report.daily[i] ?? 0, future = d.key > tk, a = dayAgg(d.key);
    return { ...d, n, future, today: d.key === tk, st: future || !n || !claimMap ? null : cellClaimState(a), open: future ? 0 : a.owed };
  });
  const toClaim = cells.reduce((s, c) => s + c.open, 0);
  return (
    <Link href="/sales/profit" aria-label="Open the weekly profit report" className={`block rounded-card bg-surface px-4 pb-3.5 pt-4 shadow-card active:scale-[0.99] ${className}`}>
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="flex items-center gap-1 text-[13px] font-bold text-muted">Your weekly profit<ChevronRight size={15} strokeWidth={2.4} aria-hidden className="text-subtle" /></span>
          <b className="mt-1 block text-[28px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{peso(report.total)}</b>
        </span>
        <span className="mt-0.5 flex-none text-right">
          <span className="block text-[12px] font-semibold text-muted">{report.label.replace(/, \d{4}$/, "")}</span>
          <span className="mt-1 block text-[11.5px] font-semibold text-muted">your share</span>
        </span>
      </span>
      <span className="mt-3.5 grid grid-cols-7 gap-1" aria-hidden>
        {cells.map((c) => (
          <span key={c.key} className={cn("flex h-[58px] min-w-0 flex-col items-center justify-center rounded-[12px]",
            c.st === "open" ? "bg-[#FDECEC]" : c.st === "claimed" ? "bg-[#E7F5EC]" : "bg-grey-50",
            c.today && "ring-[1.5px] ring-inset ring-ink")}>
            <span className={cn("text-[11px] font-bold", c.today ? "text-ink" : "text-muted")}>{c.today ? "Today" : c.dow}</span>
            <span className={cn("mt-1 whitespace-nowrap text-[13.5px] font-extrabold leading-none tabular-nums",
              c.future || !c.n ? "text-muted opacity-50" : c.st === "open" ? "text-[#C62828]" : c.st === "claimed" ? "text-[#0B7A3E]" : "text-ink")}>{c.future ? "–" : cell(c.n)}</span>
          </span>
        ))}
      </span>
      <span className="mt-3 flex items-center justify-between border-t border-line pt-2.5 text-[12.5px] font-semibold">
        {!claimMap ? <span className="text-muted">Checking claims…</span> : toClaim > 0
          ? <span className="flex items-center gap-1.5 text-[#C62828]"><i className="size-1.5 rounded-full bg-[#C62828]" />{peso(toClaim)} cash to claim</span>
          : <span className="flex items-center gap-1.5 text-[#0B7A3E]"><i className="size-1.5 rounded-full bg-[#0B7A3E]" />All cash claimed</span>}
        <span className="flex items-center gap-2.5 text-[11px] text-muted"><span className="flex items-center gap-1"><i className="size-2 rounded-[3px] bg-[#E7F5EC] ring-1 ring-[#0B7A3E]/30" />Claimed</span><span className="flex items-center gap-1"><i className="size-2 rounded-[3px] bg-[#FDECEC] ring-1 ring-[#C62828]/30" />To claim</span></span>
      </span>
    </Link>
  );
}
