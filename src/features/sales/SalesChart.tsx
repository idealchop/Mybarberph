"use client";

import { Card, cn } from "@river-apps/ui";
import { peso } from "@/lib/format";
import type { SalesRow } from "@/lib/sales-report";

/** The hour or day bars from Sales, with the busiest bar in black. */
export function SalesChartCard({
  series,
  kind,
  sales,
  className,
}: {
  series: SalesRow[];
  kind: "hour" | "day";
  sales: number;
  className?: string;
}) {
  const peak = series.reduce(
    (best, item, index) => (item.salesCentavos > best.sales ? { index, sales: item.salesCentavos, label: item.label } : best),
    { index: -1, sales: 0, label: "" },
  );
  const quiet = series.filter((item) => item.salesCentavos === 0).length;
  return (
    <Card padding="none" className={cn("px-4 py-4", className)}>
      <h2 className="text-[16px] font-bold">{kind === "hour" ? "Sales by hour" : "Sales by day"}</h2>
      <p className="mt-0.5 text-[12.5px] font-semibold text-muted">
        {peak.sales > 0 ? `Busiest ${kind === "hour" ? "at" : "on"} ${peak.label} · ${peso(peak.sales)}` : "No sales in this range yet."}
      </p>
      {series.length > 0 && sales > 0 ? (
        <FillChart series={series} peakIndex={peak.index} kind={kind} />
      ) : (
        <p className="mt-3 text-[13.5px] font-semibold text-muted">Finished cuts from this shop show up here.</p>
      )}
      {kind === "day" && quiet > 0 ? (
        <p className="mt-3 text-[12.5px] font-semibold text-muted">{quiet} {quiet === 1 ? "day" : "days"} with no sales</p>
      ) : null}
    </Card>
  );
}

function FillChart({ series, peakIndex, kind }: { series: SalesRow[]; peakIndex: number; kind: "hour" | "day" }) {
  const max = Math.max(1, ...series.map((item) => item.salesCentavos));
  const dense = series.length > 12;
  const summary = series.map((item) => `${item.label} ${peso(item.salesCentavos)}`).join(", ");
  return (
    <div className="mt-4 flex h-40 items-end gap-[3px]" role="img" aria-label={summary}>
      {series.map((item, index) => {
        const on = index === peakIndex && item.salesCentavos > 0;
        const height = item.salesCentavos <= 0 ? 8 : Math.max(14, Math.round((item.salesCentavos / max) * 100));
        const show = !dense || on || index === series.length - 1 || index % 5 === 0;
        return (
          <div key={`${item.label}-${index}`} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${item.label} · ${peso(item.salesCentavos)}`}>
            <div className="flex min-h-0 flex-1 items-end">
              <div className={cn("w-full rounded-t-[8px]", on ? "bg-ink" : "bg-grey-200")} style={{ height: `${height}%` }} />
            </div>
            <span className={cn("mt-2 h-3 truncate text-center text-[10px] leading-none", on ? "font-extrabold text-ink" : "font-semibold text-grey-400", !show && "invisible")}>
              {tick(item.label, kind)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function tick(label: string, kind: "hour" | "day") {
  if (kind === "day") return label;
  const [hour, period] = label.split(" ");
  return `${hour}${period === "AM" ? "a" : "p"}`;
}
