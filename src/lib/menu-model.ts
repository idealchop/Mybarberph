/**
 * Shared services model (pure; used by the app and the server).
 *
 * The shop's master list (haircut + other services) is defined once. Each location
 * inherits it and may override it:
 *   overrides[locationId] = {
 *     haircut?: { name?, price?, icon? }          changed fields only
 *     items?:   { [serviceId]: { enabled?, name?, price? } }
 *     extra?:   ShopTreatment-like[]              location-only services
 *   }
 * A field a location hasn't overridden always follows the master list.
 * Older files kept a full copy per location in `byLocation`; they are migrated
 * into overrides on read (diff against the master), so no data is lost.
 */
export interface MenuHaircut { name: string; durationMins: number; price?: number; icon: string }
export interface MenuService { id: string; name: string; durationMins: number; price?: number; icon: string }
export interface ItemOverride { enabled?: boolean; name?: string; price?: number }
export interface LocationOverride { haircut?: Partial<Pick<MenuHaircut, "name" | "price" | "icon">>; items?: Record<string, ItemOverride>; extra?: MenuService[] }
export interface MenuFile {
  haircut: MenuHaircut;
  treatments: MenuService[];
  overrides?: Record<string, LocationOverride>;
  /** Legacy full copies per location (read only; migrated to overrides). */
  byLocation?: Record<string, { haircut?: MenuHaircut; treatments?: MenuService[] }>;
}
export type ServiceSource = "shared" | "changed" | "local";
export interface EffectiveService extends MenuService { source: ServiceSource; enabled: boolean }

export const DEFAULT_MINS = 30;
const HOME = "home";

/** Turns a legacy per-location copy into overrides against the master list. */
export function diffToOverride(master: Pick<MenuFile, "haircut" | "treatments">, copy: { haircut?: MenuHaircut; treatments?: MenuService[] }): LocationOverride {
  const o: LocationOverride = {};
  const h = copy.haircut;
  if (h) {
    const hd: LocationOverride["haircut"] = {};
    if (h.name && h.name !== master.haircut.name) hd.name = h.name;
    if ((h.price ?? 0) !== (master.haircut.price ?? 0)) hd.price = h.price ?? 0;
    if (h.icon && h.icon !== master.haircut.icon) hd.icon = h.icon;
    if (Object.keys(hd).length) o.haircut = hd;
  }
  const list = Array.isArray(copy.treatments) ? copy.treatments : [];
  const items: Record<string, ItemOverride> = {};
  for (const m of master.treatments) {
    const t = list.find((x) => x.id === m.id);
    if (!t) { items[m.id] = { enabled: false }; continue; }
    const d: ItemOverride = {};
    if (t.name !== m.name) d.name = t.name;
    if ((t.price ?? 0) !== (m.price ?? 0)) d.price = t.price ?? 0;
    if (Object.keys(d).length) items[m.id] = d;
  }
  if (Object.keys(items).length) o.items = items;
  const extra = list.filter((t) => !master.treatments.some((m) => m.id === t.id));
  if (extra.length) o.extra = extra;
  return o;
}

/** Overrides for every location, migrating legacy copies that have no overrides yet. */
export function allOverrides(file: MenuFile): Record<string, LocationOverride> {
  const out: Record<string, LocationOverride> = { ...(file.overrides ?? {}) };
  for (const [id, copy] of Object.entries(file.byLocation ?? {})) if (!out[id] && copy) out[id] = diffToOverride(file, copy);
  return out;
}

/** Haircut + services a location sells, with where each came from. Disabled shared items are kept (enabled=false) for the editor. */
export function effectiveMenu(file: MenuFile, locationId?: string | null) {
  const o = (locationId ? allOverrides(file)[locationId] : undefined) ?? {};
  const haircut: MenuHaircut & { source: ServiceSource } = { ...file.haircut, ...(o.haircut ?? {}), durationMins: file.haircut.durationMins || DEFAULT_MINS, source: o.haircut && Object.keys(o.haircut).length ? "changed" : "shared" };
  const services: EffectiveService[] = [
    ...file.treatments.map((m) => {
      const d = o.items?.[m.id] ?? {};
      const changed = d.name !== undefined || d.price !== undefined;
      return { ...m, ...(d.name !== undefined ? { name: d.name } : {}), ...(d.price !== undefined ? { price: d.price } : {}), durationMins: m.durationMins || DEFAULT_MINS, enabled: d.enabled !== false, source: (changed ? "changed" : "shared") as ServiceSource };
    }),
    ...(o.extra ?? []).map((t) => ({ ...t, durationMins: t.durationMins || DEFAULT_MINS, enabled: true, source: "local" as ServiceSource })),
  ];
  return { haircut, services, treatments: services.filter((s) => s.enabled) };
}

export const isHome = (id?: string | null) => !id || id === HOME;
