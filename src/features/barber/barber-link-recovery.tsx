"use client";

import { Button } from "@/components/common/button";
import { PoweredBy } from "@/components/qr/shop-brand";
import { RiverSmile } from "@/components/shell/brand";
import type { BarberRecoveryKind } from "@/lib/barber-link-status";

const FRAME = "mx-auto flex min-h-dvh w-full max-w-[402px] flex-col bg-canvas px-5 pt-16";
const TITLE = "text-[28px] font-extrabold tracking-[-0.03em]";
const BODY = "mt-2 text-[15px] font-medium leading-snug text-ink-2";
const NOTE = "mt-3 text-[13px] font-semibold leading-snug text-muted";

/**
 * States for a barber link that is not showing the working home.
 * Try again / Check again re-request the same token. They do not open a different barber.
 */
export function BarberLinkRecovery({
  kind, loading, onRetry,
}: {
  kind: Exclude<BarberRecoveryKind, "home">;
  loading: boolean;
  onRetry: () => Promise<void>;
}) {
  if (kind === "opening") {
    return (
      <main role="status" aria-label="Opening your link" className="mx-auto flex min-h-dvh w-full max-w-[402px] flex-col items-center justify-center bg-canvas px-6 text-center">
        <RiverSmile color="#0A0A0A" className="block opacity-40" style={{ width: 72, height: 39 }} />
        <h1 className="mt-[18px] text-[15px] font-semibold text-ink-2">Opening your link</h1>
        <p className="mt-1.5 max-w-[260px] text-[13px] font-semibold text-muted">Checking this link with Barbers.ph.</p>
      </main>
    );
  }
  if (kind === "offline") {
    return (
      <main className={FRAME}>
        <h1 className={TITLE}>You&apos;re offline</h1>
        <p className={BODY}>This phone hasn&apos;t opened this link before, so there&apos;s nothing saved to show. Connect, then try again.</p>
        <Button className="mt-7" fullWidth loading={loading} onClick={onRetry}>Try again</Button>
        <p className={NOTE}>Try again reloads this same link. It does not turn a barber back on.</p>
        <div className="mt-auto"><PoweredBy /></div>
      </main>
    );
  }
  if (kind === "revoked") {
    return (
      <main className={FRAME}>
        <h1 className={TITLE}>This link was replaced or turned off.</h1>
        <p className={BODY}>The shop turned this barber off, or this is no longer the current link. Ask the shop to send you your current barber link.</p>
        <Button className="mt-7" fullWidth variant="secondary" loading={loading} onClick={onRetry}>Check again</Button>
        <p className={NOTE}>Check again looks up this same link. It stays off until the shop turns the barber back on.</p>
        <div className="mt-auto"><PoweredBy /></div>
      </main>
    );
  }
  return (
    <main className={FRAME}>
      <h1 className={TITLE}>Couldn&apos;t open this link</h1>
      <p className={BODY}>The connection or the server didn&apos;t answer. This does not mean the link was replaced or turned off.</p>
      <Button className="mt-7" fullWidth loading={loading} onClick={onRetry}>Try again</Button>
      <p className={NOTE}>Try again reloads this same link. If it keeps failing, ask the shop whether this barber is still active.</p>
      <div className="mt-auto"><PoweredBy /></div>
    </main>
  );
}
