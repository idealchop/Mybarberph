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

// Module-level store so a prompt fired before the Install page mounts isn't lost.
let deferred: PromptEvent | null = null;
let installed = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
let listening = false;
export function listenForInstall() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as PromptEvent; emit(); });
  window.addEventListener("appinstalled", () => { installed = true; deferred = null; emit(); });
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
const snap = () => `${deferred ? 1 : 0}${installed ? 1 : 0}`;

export type InstallState = "idle" | "installing" | "installed" | "dismissed";

export function usePwaInstall() {
  useEffect(listenForInstall, []);
  const key = useSyncExternalStore(subscribe, snap, () => "00");
  const [state, setState] = useState<InstallState>("idle");
  const [platform, setPlatform] = useState<InstallPlatform>("other");
  const [standalone, setStandalone] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => {
      setStandalone(isStandalone());
      setPlatform(installPlatform(navigator.userAgent, navigator.maxTouchPoints, key[0] === "1"));
    }, 0);
    return () => window.clearTimeout(t);
  }, [key]);
  const done = standalone || key[1] === "1" || state === "installed";

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
