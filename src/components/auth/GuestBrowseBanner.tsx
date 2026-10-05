"use client";

import { Button } from "@river-apps/ui";
import { useAuthGate } from "./AuthGateProvider";

/** Full-width guest strip — matches Laundry.ph OwnerShell. */
export function GuestBrowseBanner({ compact }: { compact?: boolean }) {
  const { openAuth, isAuthenticated } = useAuthGate();
  if (isAuthenticated) return null;
  if (compact) {
    return (
      <div className="mx-auto w-full max-w-[390px] px-4 pt-4">
        <div className="flex items-center justify-between gap-3 rounded-[18px] bg-grey-100 px-3.5 py-1.5">
          <p className="min-w-0 text-[12.5px] font-semibold leading-snug text-muted">
            Browsing as guest · sample data
          </p>
          <Button size="xs" onClick={() => openAuth(undefined, "Sign in to run your real shop.")}>
            Sign in
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="border-b border-grey-200 bg-grey-100 px-4 py-2.5">
      <div className="mx-auto flex max-w-[880px] flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-ink">
          Browsing as guest · sample data. Sign in to save changes to your shop.
        </p>
        <Button size="xs" variant="secondary" onClick={() => openAuth(undefined, "Sign in to sync your shop.")}>
          Sign up or log in
        </Button>
      </div>
    </div>
  );
}
