"use client";
/**
 * Install Barbers.ph (owner Settings › Install app, and the barber link). One layout on every phone:
 * big icon, title, one line, full-width "Install the app" and a small text link (Jimboy, 2026-10-20).
 * Android/Chrome/Edge: the browser's own install prompt. iPhone/iPad can't install from a page, so the button
 * dims the screen and points at Safari's Share button ("Tap Share, then Add to Home Screen"); tap anywhere
 * closes it. Opened from the home screen (standalone): Installed, plus a one-time welcome (PwaHost).
 */
import { CheckCircle2, Loader2, Share } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/common/button";
import { usePwaInstall } from "@/lib/pwa";

export function InstallPanel({ subtitle, back }: { subtitle: string; back: React.ReactNode }) {
  const pwa = usePwaInstall();
  const [guide, setGuide] = useState<null | "ios" | "safari" | "menu">(null);
  const installed = pwa.state === "installed";

  async function onInstall() {
    if (pwa.platform === "prompt") await pwa.install();
    else setGuide(pwa.platform === "ios-safari" ? "ios" : pwa.platform === "ios-other" ? "safari" : "menu");
  }

  return (
    <div className="flex flex-col items-center px-2 pb-6 pt-6 text-center">
      <div className="flex w-full items-center justify-center rounded-[32px] bg-grey-100 py-9">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/pwa/icon-512.png" alt="Barbers.ph app icon" width={156} height={156} className="size-[156px] rounded-[36px] shadow-card" />
      </div>
      <h1 className="mt-6 text-[28px] font-extrabold leading-[1.1] tracking-[-0.03em]">{installed ? "Installed!" : "Install Barbers.ph"}</h1>
      <p className="mt-2 max-w-[320px] text-[14.5px] font-semibold text-muted" aria-live="polite">
        {installed ? "Find Barbers.ph on your home screen." : pwa.state === "installing" ? "Installing… this takes a few seconds." : pwa.state === "dismissed" ? "Not installed. You can try again any time." : subtitle}
      </p>
      <div className="mt-7 w-full">
        {installed ? (
          <p className="flex h-12 items-center justify-center gap-2 rounded-pill bg-grey-100 text-[15px] font-bold"><CheckCircle2 size={18} aria-hidden /> Installed</p>
        ) : pwa.state === "installing" ? (
          <Button fullWidth disabled><Loader2 size={18} className="animate-spin" aria-hidden /> Installing…</Button>
        ) : (
          <Button fullWidth onClick={() => void onInstall()}>Install the app</Button>
        )}
      </div>
      <div className="mt-4 text-[13.5px] font-bold text-muted">{back}</div>
      {guide ? <InstallHint kind={guide} onClose={() => setGuide(null)} /> : null}
    </div>
  );
}

/** Lightweight pointer overlay. iPhone Safari's Share button sits in the bottom toolbar; iPad's is top right. */
function InstallHint({ kind, onClose }: { kind: "ios" | "safari" | "menu"; onClose: () => void }) {
  const ipad = typeof navigator !== "undefined" && (/iPad/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));
  const top = kind !== "ios" || ipad;
  const line = kind === "ios" ? <>Tap <Share size={16} className="mx-0.5 inline align-[-2px]" aria-label="Share" />, then <b>Add to Home Screen</b></>
    : kind === "safari" ? <>Open this page in <b>Safari</b> to install</>
    : <>Open the browser menu, then <b>Install app</b></>;
  return (
    <button type="button" onClick={onClose} aria-label="Close install hint" className="fixed inset-0 z-[80] cursor-default bg-ink/55 text-left">
      <span role="status" className={`absolute flex flex-col items-center gap-2 ${top ? "right-3 top-[max(10px,env(safe-area-inset-top))] flex-col-reverse items-end" : "inset-x-0 bottom-[max(14px,env(safe-area-inset-bottom))]"}`}>
        <span className="rounded-[16px] bg-surface px-4 py-3 text-[14.5px] font-semibold text-ink shadow-card">{line}</span>
        <span aria-hidden className={`text-[34px] leading-none text-surface ${top ? "mr-4 animate-bounce" : "animate-bounce"}`}>{top ? "↑" : "↓"}</span>
      </span>
    </button>
  );
}
