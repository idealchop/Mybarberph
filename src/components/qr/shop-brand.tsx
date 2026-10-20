"use client";
import { Avatar } from "@river-apps/ui";
import { AppVersion } from "@/components/common/app-version";
import { RiverMark } from "@/components/shell/brand";
import type { PublicShop } from "./use-public-shop";
import { StarLine } from "./shop-profile";

/** The barbershop's own look on its customer pages: facade cover, logo and name. */
export function ShopHeader({ shop, branchName, compact, trailing }: { shop: PublicShop; branchName?: string; compact?: boolean; trailing?: React.ReactNode }) {
  return (
    <header className="flex items-center gap-2.5 px-4 pt-5">
      <Avatar name={shop.name} src={shop.logoUrl || undefined} preset="sky" size={compact ? 40 : 44} decorative={false} className="flex-none ring-1 ring-line" />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[18px] font-extrabold leading-tight tracking-[-0.02em]">{shop.name}</h1>
        <p className="flex min-w-0 items-center gap-1.5"><StarLine rating={shop.rating} /><span className="truncate text-[12.5px] font-semibold text-muted">· {branchName || shop.area || shop.hours}</span></p>
      </div>
      {trailing}
    </header>
  );
}

/** Small, quiet credit at the bottom of customer pages. */
export function PoweredBy() {
  return (
    <footer className="mt-10 flex flex-col items-center pb-6">
      <span className="inline-flex items-center gap-1.5 text-[13px] font-extrabold tracking-[-0.01em] text-ink"><RiverMark size={16} /> Barbers.ph</span>
      <span className="mt-0.5 text-[10.5px] font-semibold text-muted">Powered by River Apps</span>
      <AppVersion className="mt-1" />
    </footer>
  );
}
