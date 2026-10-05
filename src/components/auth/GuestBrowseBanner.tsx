"use client";
import { Button, cn } from "@river-apps/ui";
import { useAuthGate } from "./AuthGateProvider";

/** Soft strip: you’re browsing demo data — sign in to make changes (River Mobile guest pattern). */
export function GuestBrowseBanner({ compact }: { compact?: boolean }) {
  const { openAuth, isAuthenticated } = useAuthGate();
  if (isAuthenticated) return null;
  return (
    <div
      className={cn(
        "mb-3 flex items-center justify-between gap-3 rounded-[18px] bg-grey-100 px-3.5 py-2",
        compact ? "mb-2 py-1.5" : "py-2",
      )}
    >
      <p className="min-w-0 text-[12.5px] font-semibold leading-snug text-muted">
        Browsing demo shop · sign in to save changes
      </p>
      <Button size="xs" onClick={() => openAuth(undefined, "Sign in to run your real shop.")}>
        Sign in
      </Button>
    </div>
  );
}
