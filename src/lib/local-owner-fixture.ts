/**
 * Local browser tests only. On localhost, a sessionStorage fixture can stand in for a signed-in
 * shop so the share-link screen can be opened without Firebase. Production hosts ignore it.
 */
const KEY = "bp.ownerFixture";

export interface LocalOwnerFixture {
  shopId: string;
  chairId: string | null;
  shop: Record<string, unknown> | null;
  values: Record<string, string>;
  bookings: unknown[];
}

export function readLocalOwnerFixtureFrom(host: string, read: (key: string) => string | null): LocalOwnerFixture | null {
  if (host !== "localhost" && host !== "127.0.0.1") return null;
  try {
    const raw = read(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as LocalOwnerFixture;
    if (!v || typeof v.shopId !== "string" || !v.values || typeof v.values !== "object") return null;
    return v;
  } catch {
    return null;
  }
}

export function readLocalOwnerFixture(): LocalOwnerFixture | null {
  if (typeof window === "undefined") return null;
  return readLocalOwnerFixtureFrom(window.location.hostname, (key) => sessionStorage.getItem(key));
}
