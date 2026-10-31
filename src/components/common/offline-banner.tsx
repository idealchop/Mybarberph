"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CloudOff, Check, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/common/button";
import { useCloud } from "@/lib/cloud";
import { BANNER_SHOWN, closeBanner, nextBannerHide, offlineLabel } from "@/lib/offline-queue";

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); };
}
export function useOnline() {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine !== false, () => true);
}

/**
 * v1.0.38: thin sticky bar under the header. "Offline, N haircut(s) waiting to sync" while saves wait on this
 * phone; "Synced" for a moment once they all reach the server. Takes its own row, so it never covers a button.
 */
export function OfflineBanner({ className = "" }: { className?: string }) {
  const online = useOnline();
  const { queued } = useCloud();
  const n = queued.length;
  const [synced, setSynced] = useState(false);
  const had = useRef(n);
  const [hide, setHide] = useState(BANNER_SHOWN);
  // Adjusted while rendering (React's "state from changing props" pattern), not in an effect.
  const nextHide = nextBannerHide(hide, n, online);
  if (nextHide !== hide) setHide(nextHide);
  const close = (
    <Button variant="dark" size="sm" aria-label="Close" title="Close" onClick={() => setHide(closeBanner(n, online))}
      className="absolute right-1 top-1/2 !h-7 !min-h-0 !w-7 -translate-y-1/2 !rounded-full !p-0">
      <X size={15} strokeWidth={2.4} aria-hidden />
    </Button>
  );
  useEffect(() => {
    if (had.current > 0 && n === 0 && online) {
      setSynced(true);
      const t = window.setTimeout(() => setSynced(false), 2500);
      had.current = n;
      return () => window.clearTimeout(t);
    }
    had.current = n;
  }, [n, online]);
  if ((!online || n > 0) && !hide.hidden) {
    return (
      <div role="status" aria-live="polite" className={`sticky top-0 z-30 flex h-8 items-center justify-center gap-1.5 bg-ink px-10 text-[12.5px] font-bold text-on-ink ${className}`}>
        {online ? <RefreshCw size={13} strokeWidth={2.4} className="animate-spin" aria-hidden /> : <CloudOff size={14} strokeWidth={2.4} aria-hidden />}
        <span className="truncate">{n ? offlineLabel(n, online) : "Offline, changes will sync"}</span>
        {close}
      </div>
    );
  }
  if (synced && !hide.hidden) {
    return (
      <div role="status" aria-live="polite" className={`sticky top-0 z-30 flex h-8 items-center justify-center gap-1.5 bg-[#1f8a4c] px-10 text-[12.5px] font-bold text-white ${className}`}>
        <Check size={14} strokeWidth={2.6} aria-hidden />Synced{close}
      </div>
    );
  }
  return null;
}

/** Small marker on a visit that is saved on this phone and not yet on the server. */
export function SavedOfflineTag({ id, onDark }: { id: string; onDark?: boolean }) {
  const { queued } = useCloud();
  if (!queued.includes(id)) return null;
  return (
    <span className={`inline-flex h-5 flex-none items-center gap-1 rounded-pill px-1.5 text-[10.5px] font-extrabold ${onDark ? "bg-white/15 text-on-ink" : "bg-grey-100 text-ink-2"}`}>
      <CloudOff size={11} strokeWidth={2.6} aria-hidden />Saved offline, will sync
    </span>
  );
}
