"use client";
import { cloudStorage } from "@/lib/cloud";

import { useEffect, useState } from "react";
import type { BarberIconName } from "@/components/art";
import { HOME_LOCATION_ID, useShopLocations } from "@/lib/shop-locations";
import { applyOverrides, priceAt } from "@/lib/location-prices";
import { allOverrides, effectiveMenu, type EffectiveService, type ItemOverride, type LocationOverride, type MenuFile as ModelFile, type ServiceSource } from "@/lib/menu-model";

type MenuFile = Omit<ModelFile, "haircut" | "treatments"> & { haircut: ShopHaircut; treatments: ShopTreatment[] };

/** The shop's one haircut. Styles are not priced one by one. */
export interface ShopHaircut {
  name: string;
  durationMins: number;
  /** Price in pesos. 0 = not set. */
  price?: number;
  icon: BarberIconName;
}

/** An extra the shop added, such as a beard trim or a hot towel. */
export interface ShopTreatment {
  id: string;
  name: string;
  durationMins: number;
  /** Price in pesos. 0 = not set. */
  price?: number;
  icon: BarberIconName;
}

export const HAIRCUT_ICONS: BarberIconName[] = ["clipper", "scissors", "pole"];
export const TREATMENT_ICONS: BarberIconName[] = ["razor", "towel", "scissors", "gift", "clipper"];

const KEY = "barbers.shop-menu";
const EVENT = "barbers-services";

export const defaultHaircut: ShopHaircut = { name: "Haircut", durationMins: 30, icon: "clipper" };

interface Menu {
  haircut: ShopHaircut;
  treatments: ShopTreatment[];
}

function menuFrom(parsed: Partial<Menu> | undefined): Menu {
  const haircut = parsed?.haircut?.name
    ? { ...defaultHaircut, ...parsed.haircut, name: parsed.haircut.name.trim() || defaultHaircut.name }
    : defaultHaircut;
  const treatments = Array.isArray(parsed?.treatments)
    ? parsed.treatments.filter((t) => t && t.id && t.name)
    : [];
  return { haircut, treatments };
}

/** The master list plus per-location overrides (legacy per-location copies migrated). */
function readFile(): MenuFile {
  try {
    const raw = cloudStorage.getItem(KEY);
    if (!raw) return { haircut: defaultHaircut, treatments: [], overrides: {} };
    const parsed = JSON.parse(raw) as Partial<MenuFile>;
    const base = menuFrom(parsed as Partial<Menu>);
    const legacy: MenuFile["byLocation"] = {};
    if (parsed.byLocation && typeof parsed.byLocation === "object") {
      for (const [id, menu] of Object.entries(parsed.byLocation)) if (menu) legacy[id] = menuFrom(menu as Partial<Menu>);
    }
    const file: MenuFile = { ...base, overrides: parsed.overrides && typeof parsed.overrides === "object" ? parsed.overrides : {}, byLocation: legacy };
    return { haircut: file.haircut as ShopHaircut, treatments: file.treatments as ShopTreatment[], overrides: allOverrides(file) };
  } catch {
    return { haircut: defaultHaircut, treatments: [], overrides: {} };
  }
}

function write(next: MenuFile) {
  // Overrides replace the old per-location copies for good.
  const { byLocation: _drop, ...rest } = next;
  void _drop;
  cloudStorage.setItem(KEY, JSON.stringify(rest));
  window.dispatchEvent(new Event(EVENT));
}

/** New locations inherit the master list; nothing to copy. Kept for callers. */
export function copyMenuToLocation(locationId: string) {
  void locationId;
}

export type MenuScope = "master" | string;

/**
 * Menu for a location (or the master list). Selling screens read `haircut` + `treatments`
 * (enabled only). The Services editor uses `services` (with source) and the actions below,
 * which write overrides at a location and the master list otherwise.
 */
export function useShopMenu(explicitId?: MenuScope) {
  const loc = useShopLocations();
  const scope = explicitId || (loc.enabled ? (loc.viewingAll ? "master" : loc.scopeId || HOME_LOCATION_ID) : "master");
  // Services are shop-wide: every location uses (and edits) the main list; old per-location overrides are ignored.
  const atLocation = false as boolean;
  const [file, setFile] = useState<MenuFile>({ haircut: defaultHaircut, treatments: [], overrides: {} });
  useEffect(() => {
    const pull = () => setFile(readFile());
    pull();
    window.addEventListener(EVENT, pull);
    window.addEventListener("storage", pull);
    return () => {
      window.removeEventListener(EVENT, pull);
      window.removeEventListener("storage", pull);
    };
  }, [scope]);
  const eff = effectiveMenu(file, atLocation ? scope : null);
  // Location prices (Manage shop › Edit shop details): read-only views at a location show that location's price.
  // Editors pass "master" so a location price is never saved as the default.
  const prices = scope !== "master" && loc.enabled ? loc.branches.find((b) => b.id === scope)?.priceOverrides : undefined;
  const haircut = { ...eff.haircut, price: priceAt({ id: "haircut", price: eff.haircut.price }, prices) } as ShopHaircut & { source: ServiceSource };
  const services = applyOverrides(eff.services as (ShopTreatment & EffectiveService)[], prices);
  const treatments = applyOverrides(eff.treatments as ShopTreatment[], prices);

  const commit = (fn: (f: MenuFile) => MenuFile) => { const next = fn(readFile()); setFile(next); write(next); };
  const ov = (f: MenuFile): LocationOverride => ({ ...(f.overrides?.[scope] ?? {}) });
  const putOv = (f: MenuFile, o: LocationOverride): MenuFile => ({ ...f, overrides: { ...(f.overrides ?? {}), [scope]: o } });

  const saveHaircut = (next: ShopHaircut) => commit((f) => {
    if (!atLocation) return { ...f, haircut: next };
    const d: LocationOverride["haircut"] = {};
    if (next.name !== f.haircut.name) d.name = next.name;
    if ((next.price ?? 0) !== (f.haircut.price ?? 0)) d.price = next.price ?? 0;
    if (next.icon !== f.haircut.icon) d.icon = next.icon;
    const o = ov(f); if (Object.keys(d).length) o.haircut = d; else delete o.haircut;
    return putOv(f, o);
  });
  const resetHaircut = () => commit((f) => { const o = ov(f); delete o.haircut; return putOv(f, o); });

  /** Add or edit a service. At a location: shared items get an override, others are location-only. */
  const saveTreatment = (next: ShopTreatment) => commit((f) => {
    if (!atLocation) {
      const exists = f.treatments.some((t) => t.id === next.id);
      return { ...f, treatments: exists ? f.treatments.map((t) => t.id === next.id ? next : t) : [...f.treatments, next] };
    }
    const o = ov(f);
    const m = f.treatments.find((t) => t.id === next.id);
    if (m) {
      const d: ItemOverride = { ...(o.items?.[m.id] ?? {}) };
      delete d.name; delete d.price;
      if (next.name !== m.name) d.name = next.name;
      if ((next.price ?? 0) !== (m.price ?? 0)) d.price = next.price ?? 0;
      o.items = { ...(o.items ?? {}), [m.id]: d };
    } else {
      const extra = o.extra ?? [];
      o.extra = extra.some((t) => t.id === next.id) ? extra.map((t) => t.id === next.id ? next : t) : [...extra, next];
    }
    return putOv(f, o);
  });
  const resetTreatment = (id: string) => commit((f) => { const o = ov(f); if (o.items?.[id]) { const it = { ...o.items }; const keep = it[id]?.enabled === false ? { enabled: false } : undefined; if (keep) it[id] = keep; else delete it[id]; o.items = it; } return putOv(f, o); });
  const setEnabled = (id: string, on: boolean) => commit((f) => { const o = ov(f); const d = { ...(o.items?.[id] ?? {}) }; if (on) delete d.enabled; else d.enabled = false; o.items = { ...(o.items ?? {}), [id]: d }; return putOv(f, o); });
  /** Master: removes it everywhere. Location: hides a shared item, deletes a location-only one. */
  const removeTreatment = (id: string) => commit((f) => {
    if (!atLocation) {
      const overrides = Object.fromEntries(Object.entries(f.overrides ?? {}).map(([k, o]) => { const items = { ...(o.items ?? {}) }; delete items[id]; return [k, { ...o, items }]; }));
      return { ...f, treatments: f.treatments.filter((t) => t.id !== id), overrides };
    }
    const o = ov(f);
    if (f.treatments.some((t) => t.id === id)) { o.items = { ...(o.items ?? {}), [id]: { ...(o.items?.[id] ?? {}), enabled: false } }; }
    else o.extra = (o.extra ?? []).filter((t) => t.id !== id);
    return putOv(f, o);
  });

  return { scope, atLocation, haircut, treatments, services, master: { haircut: file.haircut, treatments: file.treatments }, saveHaircut, resetHaircut, saveTreatment, resetTreatment, setEnabled, removeTreatment };
}

export function blankTreatment(): ShopTreatment {
  return {
    id: `tx-${Date.now().toString(36)}`,
    name: "",
    durationMins: 15,
    icon: "razor",
  };
}
