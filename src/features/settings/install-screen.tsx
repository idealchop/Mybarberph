"use client";
import { CoinIcon } from "@river-apps/icons";
import { Icon3d, InstallPanel } from "@/components/pwa/install-panel";
import { PageBack } from "@/components/shell/page-back";

const FEATURES = [
  { art: <Icon3d src="/icons3d/barbers/128/home.webp" />, text: "Run your barbershop from your phone" },
  { art: <Icon3d src="/icons3d/barbers/128/bookings.webp" />, text: "Take walk-ins and online bookings" },
  { art: <CoinIcon size={30} />, text: "Track sales, Cash and GCash, and barber performance" },
];

/** Settings › Install app: Barbers.ph on the owner's home screen (opens /home). */
export function InstallScreen() {
  return (
    <main className="mx-auto w-full max-w-[460px] px-4 pb-10 pt-4">
      <PageBack fallback="/settings" />
      <InstallPanel features={FEATURES} />
    </main>
  );
}
