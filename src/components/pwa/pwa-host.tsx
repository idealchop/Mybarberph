"use client";
import { BUILD_ID } from "@/lib/app-version";
/**
 * Registers the service worker and shows "Update available" when a newer deploy is live (Jimboy, 2026-10-20).
 * A new version is found by the SW update check and by /api/version, on load, when the tab comes back and
 * every 30 minutes. Nothing reloads by itself: the page only reloads after the person taps Update, so a
 * half-filled form is never lost.
 */
import { CheckCircle2, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { isStandalone, listenForInstall } from "@/lib/pwa";

const BUILD = BUILD_ID;
const EVERY = 30 * 60_000;

const ownVersion = (w: ServiceWorker | null | undefined) => !!w && new URL(w.scriptURL).searchParams.get("v") === BUILD;

export function PwaHost() {
  const [update, setUpdate] = useState(false);
  const [busy, setBusy] = useState(false);
  const reg = useRef<ServiceWorkerRegistration | null>(null);
  const wanted = useRef(false);

  useEffect(() => {
    listenForInstall();
    if (process.env.NODE_ENV !== "production") return;
    let stop = false;
    const watch = (w: ServiceWorker | null) => {
      if (!w) return;
      const settle = () => {
        if (w.state !== "installed") return;
        // The worker for the code already on screen just takes over quietly; a newer one waits for Update.
        if (ownVersion(w)) w.postMessage("SKIP_WAITING");
        else if (navigator.serviceWorker.controller) setUpdate(true);
      };
      settle();
      w.addEventListener("statechange", settle);
    };
    // A new worker took over. Reload when asked (Update button) or right at launch, before anything was typed;
    // later in a session the "Update available" bar asks first. Guarded so it reloads at most once a minute.
    // First visit: the first worker claiming the page is not an update, so no reload then.
    const hadController = !!navigator.serviceWorker?.controller;
    const onController = () => {
      if (!hadController && !wanted.current) return;
      const atLaunch = performance.now() < 15_000;
      if (!wanted.current && !atLaunch) { setUpdate(true); return; }
      try { const k = "bp.swReload", last = Number(sessionStorage.getItem(k)) || 0; if (Date.now() - last < 60_000) return; sessionStorage.setItem(k, String(Date.now())); } catch { /* storage blocked */ }
      window.location.reload();
    };
    const check = async () => {
      if (stop || document.visibilityState !== "visible") return;
      void reg.current?.update().catch(() => {});
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        const { build } = (await res.json()) as { build?: string };
        if (build && build !== "dev" && BUILD !== "dev" && build !== BUILD) setUpdate(true);
      } catch { /* offline: try again later */ }
    };
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", onController);
      navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(BUILD)}`, { scope: "/", updateViaCache: "none" }).then((r) => {
        reg.current = r;
        watch(r.waiting);
        watch(r.installing);
        r.addEventListener("updatefound", () => watch(r.installing));
      }).catch(() => {});
    }
    void check();
    const onVis = () => void check();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    const t = window.setInterval(onVis, EVERY);
    return () => {
      stop = true;
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
      window.clearInterval(t);
      if ("serviceWorker" in navigator) navigator.serviceWorker.removeEventListener("controllerchange", onController);
    };
  }, []);

  async function apply() {
    setBusy(true);
    wanted.current = true;
    const r = reg.current;
    try { await r?.update(); } catch { /* reload anyway */ }
    const w = r?.waiting;
    if (w && navigator.serviceWorker.controller) {
      w.postMessage("SKIP_WAITING"); // controllerchange reloads
      window.setTimeout(() => window.location.reload(), 3000);
    } else window.location.reload();
  }

  if (!update) return <InstalledWelcome />;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-[90] flex justify-center px-3 pt-[max(8px,env(safe-area-inset-top))]">
      <div className="flex w-full max-w-[402px] items-center gap-3 rounded-pill bg-ink py-1.5 pl-4 pr-1.5 text-on-ink shadow-card">
        <span className="min-w-0 flex-1 truncate text-[13px] font-bold">Update available</span>
        <button type="button" onClick={() => void apply()} disabled={busy} className="inline-flex h-9 flex-none items-center gap-1.5 rounded-pill bg-surface px-4 text-[13px] font-bold text-ink disabled:opacity-60">
          <RefreshCw size={14} className={busy ? "animate-spin" : ""} aria-hidden /> {busy ? "Updating…" : "Update"}
        </button>
      </div>
    </div>
  );
}

/** First launch from the home screen: "Installed! Welcome" once per device. */
export function InstalledWelcome() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        if (isStandalone() && !localStorage.getItem("barbers.pwa-welcomed")) { localStorage.setItem("barbers.pwa-welcomed", "1"); setShow(true); }
      } catch { /* private mode */ }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => { if (!show) return; const t = window.setTimeout(() => setShow(false), 4000); return () => window.clearTimeout(t); }, [show]);
  if (!show) return null;
  return (
    <button type="button" onClick={() => setShow(false)} role="status" className="fixed inset-x-0 bottom-[max(90px,calc(env(safe-area-inset-bottom)+80px))] z-[90] mx-auto flex w-fit items-center gap-2 rounded-pill bg-ink px-4 py-2.5 text-[14px] font-bold text-on-ink shadow-card">
      <CheckCircle2 size={17} aria-hidden /> Installed! Welcome
    </button>
  );
}
