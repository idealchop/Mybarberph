"use client";
import { cn, SegmentedControl } from "@river-apps/ui";
import type { Tier } from "@/data";
import { useTier } from "@/lib/tier";

/** Demo-only control to preview Partner (free) vs Paid gating. Not part of the product UI. */
export function DemoTierSwitch({ className, floating = true }: { className?: string; floating?: boolean }) {
  const { tier, setTier } = useTier();
  return (
    <div className={cn(floating ? "fixed bottom-4 right-4 z-50 hidden md:inline-flex" : "inline-flex",
      "items-center gap-2 rounded-pill bg-surface py-1 pl-3 pr-1 shadow-float", className)}>
      <span className="text-[11.5px] font-bold text-muted">Demo tier</span>
      <SegmentedControl<Tier> label="Demo tier" value={tier} onChange={setTier}
        options={[{ value: "partner", label: "Partner" }, { value: "paid", label: "Paid" }]}
        className="rounded-pill [&>button]:rounded-pill" />
    </div>
  );
}
