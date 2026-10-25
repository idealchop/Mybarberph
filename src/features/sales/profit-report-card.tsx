"use client";

import { useChairRequests } from "@/lib/chair-bookings";
import { peso } from "@/lib/format";
import { HOME_LOCATION_ID, useShopLocations } from "@/lib/shop-locations";
import { useShopChairs } from "@/lib/shop-chairs";
import { useShopProfile } from "@/lib/shop-profile";
import { profitWeek } from "@/lib/profit-report";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useSalesRows } from "./use-sales-rows";

const cell = (n: number) => (n ? peso(n) : "–");

/** Home preview of this week’s profit report. The whole card opens the full grid. */
export function ProfitReportCard({ className = "" }: { className?: string }) {
  const shops = useShopLocations();
  const { profile } = useShopProfile();
  const { chairs } = useShopChairs({ all: true });
  const deep = useSalesRows(70);
  const cloud = useChairRequests();
  const rows = deep ?? cloud.rows;
  const branches = useMemo(
    () => (shops.enabled ? shops.branches : [{ id: HOME_LOCATION_ID, name: profile.name || "Main" }]),
    [shops.enabled, shops.branches, profile.name],
  );
  const where = shops.viewingAll || !shops.enabled ? "all" : shops.scopeId ?? "all";
  const report = profitWeek(rows, chairs, where, 0, Date.now(), branches);
  return (
    <Link href="/sales/profit" aria-label="Open the profit report" className={`block rounded-card bg-surface px-3.5 py-3 shadow-card ${className}`}>
      <span className="flex items-start gap-2">
        <span className="min-w-0 flex-1">
          <b className="block text-[15px]">Weekly profit</b>
          <span className="mt-0.5 block truncate text-[12.5px] font-semibold text-muted">{report.label}</span>
        </span>
        <b className="flex-none text-[16px] tabular-nums">{peso(report.total)}</b>
        <ChevronRight size={18} className="mt-0.5 flex-none text-muted" aria-hidden />
      </span>
      <span className="mt-2.5 flex justify-between gap-1 overflow-x-auto" aria-hidden>
        {report.days.map((d, i) => (
          <span key={d.key} className="w-max min-w-10 flex-none text-center">
            <span className="block text-[10.5px] font-bold text-muted">{d.dow}</span>
            <span className="mt-0.5 block whitespace-nowrap text-[10px] font-extrabold tabular-nums">{cell(report.daily[i] ?? 0)}</span>
          </span>
        ))}
      </span>
    </Link>
  );
}
