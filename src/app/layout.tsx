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
// HTML may sit in a CDN (Firebase Hosting in front of barbersph.web.app) for at most a minute, never for a year:
// an old page points at build files that are gone after a deploy and never starts (Jimboy, 2026-10-20).
export const revalidate = 60;

/**
 * Safety net: if a build file from /_next/static fails to load (an old cached page after a deploy), reload once
 * with a cache-busting query so the CDN hands back the current page. Guarded so it can never loop.
 */
const CHUNK_RECOVERY = `(function(){var k="bp.chunkReload";addEventListener("error",function(e){var t=e.target,u=t&&(t.src||t.href)||"";if(u.indexOf("/_next/static/")<0)return;try{var last=+sessionStorage.getItem(k)||0;if(Date.now()-last<60000)return;sessionStorage.setItem(k,String(Date.now()))}catch(_){return}var l=new URL(location.href);l.searchParams.set("_v",Date.now().toString(36));location.replace(l.toString())},true)})();`;

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0A0A0A", interactiveWidget: "resizes-content" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: CHUNK_RECOVERY }} />
      </head>
      <body>
        <TierProvider>{children}<CompleteFlowHost /></TierProvider>
        <PwaHost />
      </body>
    </html>
  );
}
