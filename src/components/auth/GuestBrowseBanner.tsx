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
        "sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur",
        compact ? "py-2" : "py-2.5 sm:px-8",
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
