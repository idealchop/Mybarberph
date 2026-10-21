/**
 * Per-location service prices (Jimboy, 2026-10-21). Each location may set its own price for a service:
 * branch.priceOverrides = { [serviceId]: price }. Missing/empty = the shop's default price.
 * Client menus and the locations state hold pesos; the server mirror holds centavos (like its menu).
 */
export type PriceOverrides = Record<string, number>;

/** Keeps only valid, non-negative prices for known-looking ids (max ₱100,000). */
export function cleanOverrides(raw: unknown, max = 100_000): PriceOverrides {
  const out: PriceOverrides = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[\w-]{1,60}$/.test(id) || v === null || v === "" || v === undefined) continue;
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0 && n <= max) out[id] = Math.round(n * 100) / 100;
  }
  return out;
}

/** The price for one service at a location: the override when set, else the default. */
export function priceAt<T extends { id: string; price?: number }>(item: T, overrides?: PriceOverrides | null): number | undefined {
  const o = overrides?.[item.id];
  return typeof o === "number" && Number.isFinite(o) && o >= 0 ? o : item.price;
}

/** A menu with this location's prices applied (same items, same order). */
export function applyOverrides<T extends { id: string; price?: number }>(menu: T[], overrides?: PriceOverrides | null): T[] {
  if (!overrides || !Object.keys(overrides).length) return menu;
  return menu.map((m) => (overrides[m.id] != null ? { ...m, price: priceAt(m, overrides) } : m));
}

/** Pesos (client) → centavos (server mirror). */
export function toCentavos(o: PriceOverrides): PriceOverrides {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 100)]));
}

/** Draft (text inputs) → saved overrides; blank or equal-to-default = use the default. */
export function draftToOverrides(draft: Record<string, string>, defaults: { id: string; price: number }[]): PriceOverrides {
  const raw: Record<string, unknown> = {};
  for (const d of defaults) {
    const v = (draft[d.id] ?? "").trim();
    if (v !== "" && Number(v) !== d.price) raw[d.id] = v;
  }
  return cleanOverrides(raw);
}
