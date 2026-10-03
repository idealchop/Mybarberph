import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "@river-apps/tokens/fonts.css";
import "./globals.css";
import { TierProvider, TIER_COOKIE } from "@/lib/tier";
import type { Tier } from "@/data";

export const metadata: Metadata = {
  title: { default: "Barbers.ph", template: "%s · Barbers.ph" },
  description: "Barbers.ph by River Apps: queue, sales record, kiosk and River Mobile partner app for barbershops. Demo with sample data.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0A0A0A" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const c = (await cookies()).get(TIER_COOKIE)?.value;
  const tier: Tier = c === "partner" ? "partner" : "paid";
  return (
    <html lang="en">
      <body>
        <TierProvider initialTier={tier}>{children}</TierProvider>
      </body>
    </html>
  );
}
