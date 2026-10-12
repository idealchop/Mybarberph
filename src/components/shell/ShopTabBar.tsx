"use client";

import { ChatIcon } from "@river-apps/icons";
import { Badge, cn, type NavItem } from "@river-apps/ui";
import { BarberIcon } from "@/components/art";

/** 3D marks for the phone bar: pole for the shop, ticket for the queue, chat for community. */
function TabIcon({ itemKey }: { itemKey: string }) {
  if (itemKey === "queue") return <BarberIcon name="ticket" size={28} />;
  if (itemKey === "community") return <ChatIcon size={28} />;
  return <BarberIcon name="pole" size={28} />;
}

/**
 * Phone tab bar, same shape as Laundry.ph: icon only, no label.
 * The pictures are the barbershop marks, not the laundry washer and basket.
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
                on ? "opacity-100" : "opacity-55 hover:opacity-80",
              )}
            >
              <TabIcon itemKey={it.key} />
              {it.badge ? <Badge variant="count" className="absolute right-0 top-0" aria-hidden>{it.badge}</Badge> : null}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
