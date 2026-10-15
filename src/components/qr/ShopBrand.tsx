"use client";
import { Avatar } from "@river-apps/ui";
import { RiverMark } from "@/components/shell/Brand";
import type { PublicShop } from "./usePublicShop";

/** The barbershop's own look on its customer pages: facade cover, logo and name. */
export function ShopHeader({ shop, branchName, compact }: { shop: PublicShop; branchName?: string; compact?: boolean }) {
  return (
    <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3">
      <Avatar name={shop.name} src={shop.logoUrl || undefined} preset="sky" size={compact ? 40 : 48} decorative={false} className="flex-none ring-1 ring-line" />
      <div className="min-w-0">
        <h1 className="truncate text-[17px] font-extrabold leading-tight tracking-[-0.02em]">{shop.name}</h1>
        <p className="truncate text-[12.5px] font-semibold text-muted">{branchName || shop.area || shop.hours}</p>
      </div>
    </header>
  );
}

/** Small, quiet credit at the bottom of customer pages. */
export function PoweredBy() {
  return (
    <footer className="mt-10 flex flex-col items-center pb-6">
      <span className="inline-flex items-center gap-1.5 text-[13px] font-extrabold tracking-[-0.01em] text-ink"><RiverMark size={16} /> Barbers.ph</span>
      <span className="mt-0.5 text-[10.5px] font-semibold text-muted">Powered by River Apps</span>
    </footer>
  );
}
