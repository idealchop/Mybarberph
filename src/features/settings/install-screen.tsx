"use client";
import { CoinIcon } from "@river-apps/icons";
import { Icon3d, InstallPanel } from "@/components/pwa/install-panel";
import { PageBack } from "@/components/shell/page-back";

const FEATURES = [
  { art: <Icon3d src="/icons3d/barbers/128/home.webp" />, text: "Run your barbershop from your phone" },
  { art: <Icon3d src="/icons3d/barbers/128/bookings.webp" />, text: "Take walk-ins and online bookings" },
  { art: <CoinIcon size={30} />, text: "Track sales, Cash and GCash, and barber performance" },
];

/** Settings › Install app: Barbers.ph on the owner's home screen (opens /home). Always reachable when installed. */
export function InstallScreen() {
  return (
    <main className="mx-auto w-full max-w-[460px] px-4 pb-10 pt-4">
      <div className="flex items-center gap-1">
        <PageBack fallback="/settings" />
        <h2 className="text-[18px] font-extrabold tracking-[-0.02em]">Install app</h2>
      </div>
      <InstallPanel features={FEATURES} />
    </main>
  );
}
