"use client";

import { Badge, cn, type NavItem } from "@river-apps/ui";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { bottomGap, keyboardOpen } from "@/lib/viewport-gap";

const noop = () => () => {};
const editable = (el: Element | null) => !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el as HTMLElement).isContentEditable);

/**
 * Keeps the bar on the visible bottom edge on iOS (installed PWA included): follows the visual viewport, nudges
 * Safari to drop a stale layout viewport after the keyboard closes, and hides the bar while typing.
 */
function useBottomPin() {
  const [state, setState] = useState({ gap: 0, hidden: false });
  useEffect(() => {
    const vv = window.visualViewport;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const h = window.innerHeight;
        const vh = vv?.height ?? h, top = vv?.offsetTop ?? 0;
        const typing = editable(document.activeElement) && keyboardOpen(h, vh);
        const next = { gap: typing ? 0 : bottomGap(h, vh, top), hidden: typing };
        setState((p) => (p.gap === next.gap && p.hidden === next.hidden ? p : next));
      });
    };
    // After an input loses focus iOS can keep the shrunken layout viewport until something scrolls: nudge it.
    const onBlur = () => window.setTimeout(() => { window.scrollTo(window.scrollX, window.scrollY); update(); }, 60);
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.addEventListener("pageshow", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", onBlur);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      cancelAnimationFrame(raf);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.removeEventListener("pageshow", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", onBlur);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return state;
}

/**
 * Phone tab bar, same shape as Laundry.ph: icon only, no label.
 * Icons are River Mobile 3D icons; the active one is full colour on a soft pill, others muted.
 */
export function ShopTabBar({ items, activeKey, label = "Main" }: { items: NavItem[]; activeKey: string; label?: string }) {
  const { gap, hidden } = useBottomPin();
  const host = useSyncExternalStore(noop, () => document.body, () => null);
  const bar = (
    <nav
      aria-label={label}
      aria-hidden={hidden || undefined}
      style={{ transform: gap ? `translate3d(0, ${gap}px, 0)` : undefined, visibility: hidden ? "hidden" : undefined }}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 shadow-[0_-8px_24px_-16px_rgba(16,16,24,0.18)] backdrop-blur-md lg:hidden"
    >
      <div
        className="mx-auto flex max-w-[402px] items-center justify-around px-4 pt-2"
        style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}
      >
        {items.map((it) => {
          const on = it.key === activeKey;
          return (
            <a
              key={it.key}
              href={it.href ?? "#"}
              aria-current={on ? "page" : undefined}
              aria-label={it.badge ? `${it.label}, ${it.badge}` : it.label}
              title={it.label}
              className={cn(
                "relative inline-flex size-12 items-center justify-center rounded-full transition-opacity",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                on ? "bg-grey-100" : "hover:bg-grey-100/60",
              )}
            >
              {it.icon}
              {it.badge ? <Badge variant="count" className="absolute right-0 top-0" aria-hidden>{it.badge}</Badge> : null}
            </a>
          );
        })}
      </div>
    </nav>
  );
  // Rendered straight into <body> so no ancestor (transform, filter, overflow, a scrolling box) can re-anchor it.
  return host ? createPortal(bar, host) : null;
}
