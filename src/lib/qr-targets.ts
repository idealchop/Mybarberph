import { bookingUrl } from "@/lib/chair-bookings";

/** One QR card per location (v1.0.27). Active location first; the rest keep the owner's order. */
export interface QrTarget { id: string | undefined; name: string; url: string; active: boolean; file: string }

const slug = (s: string) => s.replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "") || "shop";

export function qrTargets(o: { origin: string; shopId: string; shopName: string; enabled: boolean; branches: { id: string; name: string }[]; activeId?: string | null }): QrTarget[] {
  if (!o.origin || !o.shopId) return [];
  // Single-shop accounts: one QR without a location (the booking page uses the main shop).
  const list = o.enabled && o.branches.length
    ? o.branches.map((b) => ({ id: b.id as string | undefined, name: b.name || "Shop" }))
    : [{ id: undefined, name: o.shopName || "Shop" }];
  const active = o.enabled ? o.activeId ?? null : null;
  return list
    .map((b) => ({ ...b, url: bookingUrl(o.origin, o.shopId, b.id), active: !o.enabled || b.id === active,
      file: `${slug(o.shopName || "shop")}${o.enabled && b.name !== o.shopName ? `-${slug(b.name)}` : ""}-QR.png` }))
    .sort((a, b) => Number(b.active) - Number(a.active));
}
