"use client";
/**
 * Install and update helpers (Jimboy, 2026-10-20).
 * - Android / Chrome / Edge: the browser's beforeinstallprompt is captured early and replayed by the Install button.
 * - iPhone / iPad: there is no install API. Safari's Share › Add to Home Screen makes the shortcut, so the
 *   Install button opens a short guide; other iOS browsers are asked to open the page in Safari.
 */
import { useEffect, useState, useSyncExternalStore } from "react";

export type InstallPlatform = "ios-safari" | "ios-other" | "prompt" | "other";

interface PromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }

/** Pure: which install path a browser gets. */
export function installPlatform(ua: string, touchPoints = 0, hasPrompt = false): InstallPlatform {
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|FBAN|FBAV|Instagram|Line\//.test(ua) ? "ios-other" : "ios-safari";
  return hasPrompt ? "prompt" : "other";
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

/**
 * Installed memory (Jimboy, 2026-10-20): browsers don't say whether a page is on the home screen, so we remember
 * it per install scope in localStorage. Set on `appinstalled` and on every standalone launch.
 * Scope: "owner" for the owner app, "b:<token>" for a barber link (each link installs as its own app).
 */
export const installScope = (token?: string | null) => (token ? `b:${token}` : "owner");
export const installedKey = (scope: string) => `barbers.pwa-installed.${scope}`;
/** Scope from a URL path: /b/<token>… is that barber link; anything else is the owner app. */
export function scopeFromPath(path: string) {
  const m = /^\/b\/([^/?#]+)/.exec(path);
  return installScope(m ? decodeURIComponent(m[1]!) : null);
}
type KV = Pick<Storage, "getItem" | "setItem">;
const store = (): KV | null => { try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; } };
export function markInstalled(scope: string, kv: KV | null = store()) { try { kv?.setItem(installedKey(scope), String(Date.now())); } catch { /* private mode */ } }
export function wasInstalled(scope: string, kv: KV | null = store()) { try { return !!kv?.getItem(installedKey(scope)); } catch { return false; } }
/** Pure: hide install prompts when running from the home screen or when this scope was installed before. */
export const hideInstall = (o: { standalone: boolean; remembered: boolean }) => o.standalone || o.remembered;

/** Hook: true once the install card for this scope should stay hidden (false during SSR/first paint). */
export function useInstallHidden(token?: string | null) {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    listenForInstall();
    const scope = installScope(token);
    const check = () => setHidden(hideInstall({ standalone: isStandalone(), remembered: wasInstalled(scope) }));
    const t = window.setTimeout(check, 0);
    subs.add(check);
    return () => { window.clearTimeout(t); subs.delete(check); };
  }, [token]);
  return hidden;
}

// Module-level store so a prompt fired before the Install page mounts isn't lost.
let deferred: PromptEvent | null = null;
let installed = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
let listening = false;
export function listenForInstall() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  if (isStandalone()) markInstalled(scopeFromPath(location.pathname));
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as PromptEvent; emit(); });
  window.addEventListener("appinstalled", () => { installed = true; deferred = null; markInstalled(scopeFromPath(location.pathname)); emit(); });
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
const snap = () => `${deferred ? 1 : 0}${installed ? 1 : 0}`;

export type InstallState = "idle" | "installing" | "installed" | "dismissed";

export function usePwaInstall(token?: string | null) {
  useEffect(listenForInstall, []);
  const key = useSyncExternalStore(subscribe, snap, () => "00");
  const [state, setState] = useState<InstallState>("idle");
  const [platform, setPlatform] = useState<InstallPlatform>("other");
  const [standalone, setStandalone] = useState(false);
  const [remembered, setRemembered] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => {
      setStandalone(isStandalone());
      setRemembered(wasInstalled(installScope(token)));
      setPlatform(installPlatform(navigator.userAgent, navigator.maxTouchPoints, key[0] === "1"));
    }, 0);
    return () => window.clearTimeout(t);
  }, [key, token]);
  const done = hideInstall({ standalone, remembered }) || key[1] === "1" || state === "installed";

  async function install() {
    const e = deferred;
    if (!e) return false;
    await e.prompt();
    const { outcome } = await e.userChoice;
    deferred = null; emit();
    if (outcome !== "accepted") { setState("dismissed"); return false; }
    setState("installing");
    // appinstalled usually follows within seconds; don't leave the spinner up if the browser never sends it.
    window.setTimeout(() => setState("installed"), 4000);
    return true;
  }
  return { platform, state: done ? ("installed" as const) : state, standalone, install };
}
