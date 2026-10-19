"use client";
import { BarChart3, CalendarCheck, Scissors, Zap } from "lucide-react";
import { InstallPanel } from "@/components/pwa/install-panel";
import { PageBack } from "@/components/shell/page-back";

const FEATURES = [
  { icon: Scissors, text: "Run your barbershop from your phone" },
  { icon: CalendarCheck, text: "Take walk-ins and online bookings" },
  { icon: BarChart3, text: "Track sales, Cash and GCash, and barber performance" },
  { icon: Zap, text: "Opens fast, like a real app" },
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
