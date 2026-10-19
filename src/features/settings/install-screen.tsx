"use client";
import Link from "next/link";
import { InstallPanel } from "@/components/pwa/install-panel";
import { PageBack } from "@/components/shell/page-back";

/** Settings › Install app: Barbers.ph on the owner's home screen (opens /home). */
export function InstallScreen() {
  return (
    <main className="mx-auto w-full max-w-[460px] px-4 pb-10 pt-4">
      <PageBack fallback="/settings" />
      <InstallPanel subtitle="Open your shop from the home screen, like an app." back={<Link href="/settings" className="hover:underline">Not now</Link>} />
    </main>
  );
}
