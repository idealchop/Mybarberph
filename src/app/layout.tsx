import { CompleteFlowHost } from "@/components/transactions/CompleteFlow";
import type { Metadata, Viewport } from "next";
import "@river-apps/tokens/fonts.css";
import "./globals.css";
import { TierProvider } from "@/lib/tier";

export const metadata: Metadata = {
  title: { default: "Barbers.ph", template: "%s · Barbers.ph" },
  description: "Barbers.ph by River Apps. Customers book from the shop QR. The shop runs from Home, Queue, and Moments.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0A0A0A", interactiveWidget: "resizes-content" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TierProvider>{children}<CompleteFlowHost /></TierProvider>
      </body>
    </html>
  );
}
