import { CompleteFlowHost } from "@/components/transactions/complete-flow";
import type { Metadata, Viewport } from "next";
import "@river-apps/tokens/fonts.css";
import "./globals.css";
import { TierProvider } from "@/lib/tier";
import { PwaHost } from "@/components/pwa/pwa-host";

export const metadata: Metadata = {
  title: { default: "Barbers.ph", template: "%s · Barbers.ph" },
  description: "Barbers.ph by River Apps. Customers book from the shop QR. The shop runs from Home, Queue, and Moments.",
  robots: { index: false, follow: false },
  // Owner app manifest (start_url /home). Barber links swap in their own per-token manifest.
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Barbers.ph", statusBarStyle: "default" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0A0A0A", interactiveWidget: "resizes-content" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TierProvider>{children}<CompleteFlowHost /></TierProvider>
        <PwaHost />
      </body>
    </html>
  );
}
