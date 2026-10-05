import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "@river-apps/tokens/fonts.css";
import "./globals.css";
import { AuthGateProvider } from "@/components/auth/AuthGateProvider";
import { AuthProvider } from "@/lib/firebase/auth-context";
import { TierProvider } from "@/lib/tier";
import { parseTier, TIER_COOKIE } from "@/lib/tier-shared";

export const metadata: Metadata = {
  title: { default: "Barbers.ph", template: "%s · Barbers.ph" },
  description: "Barbers.ph by River Apps: queue, sales record, kiosk and River Mobile partner app for barbershops.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0A0A0A" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const tier = parseTier((await cookies()).get(TIER_COOKIE)?.value);
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AuthGateProvider>
            <TierProvider initialTier={tier}>{children}</TierProvider>
          </AuthGateProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
