"use client";

import { Badge, cn, type NavItem } from "@river-apps/ui";

/**
 * Phone tab bar, same shape as Laundry.ph: icon only, no label.
 * Icons are River Mobile 3D icons; the active one is full colour on a soft pill, others muted.
 */
export function ShopTabBar({ items, activeKey, label = "Main" }: { items: NavItem[]; activeKey: string; label?: string }) {
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 shadow-[0_-8px_24px_-16px_rgba(16,16,24,0.18)] backdrop-blur-md"
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
}
