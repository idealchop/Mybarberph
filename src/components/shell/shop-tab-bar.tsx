"use client";

import { Badge, cn, type NavItem } from "@river-apps/ui";
import { useEffect, useState } from "react";

const editable = (el: Element | null) => !!el && ((el instanceof HTMLInputElement && !["checkbox", "radio", "range", "button", "submit"].includes(el.type)) || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el as HTMLElement).isContentEditable);

/** Hide the bar while a text field has focus (on phones the keyboard covers it anyway). */
function useTyping() {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const on = () => setTyping(editable(document.activeElement));
    const off = () => window.setTimeout(on, 0);
    document.addEventListener("focusin", on);
    document.addEventListener("focusout", off);
    return () => { document.removeEventListener("focusin", on); document.removeEventListener("focusout", off); };
  }, []);
  return typing;
}

/**
 * Bottom tab bar. NOT position:fixed (v1.0.18): it is the last flex child of the app shell, which is exactly the
 * visible viewport, so it cannot float mid-screen when iOS keeps a stale layout viewport. See ShopShell.
 */
export function ShopTabBar({ items, activeKey, label = "Main" }: { items: NavItem[]; activeKey: string; label?: string }) {
  const typing = useTyping();
  return (
    <nav
      aria-label={label}
      data-typing={typing || undefined}
      className="shrink-0 border-t border-line bg-surface shadow-[0_-8px_24px_-16px_rgba(16,16,24,0.18)] data-[typing]:hidden lg:hidden"
    >
      <div className="mx-auto flex max-w-[402px] items-center justify-around px-4 pt-2" style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}>
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
}
