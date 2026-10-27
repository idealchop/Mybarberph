"use client";

import { Badge, cn, type NavItem } from "@river-apps/ui";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { barOffset, bottomGap, keyboardOpen } from "@/lib/viewport-gap";

const noop = () => () => {};
const editable = (el: Element | null) => !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el as HTMLElement).isContentEditable);

/**
 * Keeps the bar on the visible bottom edge on iOS (installed PWA included). Root cause of the "nav floats mid-screen"
 * bug: after the keyboard, a sheet's scroll-lock or a toolbar change, iOS can keep a stale, shorter layout viewport
 * that `position: fixed; bottom: 0` anchors to, while window.innerHeight already reports the new value, so a gap
 * inferred from innerHeight is 0 and the bar stays high. Instead we MEASURE where the bar really is and move it by
 * the difference to the visual viewport's bottom; re-checked on window scroll, viewport changes and body style
 * changes (sheet open/close). The bar hides while typing.
 */
function useBottomPin(ref: React.RefObject<HTMLElement | null>) {
  const [state, setState] = useState({ gap: 0, hidden: false });
  const gapRef = useRef(0);
  useEffect(() => {
    const vv = window.visualViewport;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const h = window.innerHeight;
        const vh = vv?.height ?? h, top = vv?.offsetTop ?? 0;
        const typing = editable(document.activeElement) && keyboardOpen(h, vh);
        const el = ref.current;
        const bottom = el && !typing ? el.getBoundingClientRect().bottom - gapRef.current : null;
        const gap = typing ? 0 : bottom == null ? bottomGap(h, vh, top) : barOffset(bottom, vh, top);
        gapRef.current = gap;
        setState((p) => (p.gap === gap && p.hidden === typing ? p : { gap, hidden: typing }));
      });
    };
    // After an input loses focus iOS can keep the shrunken layout viewport until something scrolls: nudge it.
    const onBlur = () => window.setTimeout(() => { window.scrollTo(window.scrollX, window.scrollY); update(); }, 60);
    const later = () => { update(); window.setTimeout(update, 350); };
    const mo = new MutationObserver(later);
    mo.observe(document.body, { attributes: true, attributeFilter: ["style", "class"] });
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", later);
    window.addEventListener("orientationchange", later);
    window.addEventListener("pageshow", later);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", onBlur);
    document.addEventListener("visibilitychange", later);
    update();
    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", later);
      window.removeEventListener("orientationchange", later);
      window.removeEventListener("pageshow", later);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", onBlur);
      document.removeEventListener("visibilitychange", later);
    };
  }, [ref]);
  return state;
}

export function ShopTabBar({ items, activeKey, label = "Main" }: { items: NavItem[]; activeKey: string; label?: string }) {
  const navRef = useRef<HTMLElement>(null);
  const { gap, hidden } = useBottomPin(navRef);
  const host = useSyncExternalStore(noop, () => document.body, () => null);
  const bar = (
    <nav
      ref={navRef}
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
