"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CloudOff, Check, RefreshCw } from "lucide-react";
import { useCloud } from "@/lib/cloud";
import { offlineLabel } from "@/lib/offline-queue";

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
  useEffect(() => {
    if (had.current > 0 && n === 0 && online) {
      setSynced(true);
      const t = window.setTimeout(() => setSynced(false), 2500);
      had.current = n;
      return () => window.clearTimeout(t);
    }
    had.current = n;
  }, [n, online]);
  if (!online || n > 0) {
    return (
      <div role="status" aria-live="polite" className={`sticky top-0 z-30 flex h-8 items-center justify-center gap-1.5 bg-ink px-4 text-[12.5px] font-bold text-on-ink ${className}`}>
        {online ? <RefreshCw size={13} strokeWidth={2.4} className="animate-spin" aria-hidden /> : <CloudOff size={14} strokeWidth={2.4} aria-hidden />}
        <span className="truncate">{n ? offlineLabel(n, online) : "Offline, changes will sync"}</span>
      </div>
    );
  }
  if (synced) {
    return (
      <div role="status" aria-live="polite" className={`sticky top-0 z-30 flex h-8 items-center justify-center gap-1.5 bg-[#1f8a4c] px-4 text-[12.5px] font-bold text-white ${className}`}>
        <Check size={14} strokeWidth={2.6} aria-hidden />Synced
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
