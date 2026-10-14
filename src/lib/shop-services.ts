"use client";
import { cloudStorage } from "@/lib/cloud";

import { useEffect, useState } from "react";
import type { BarberIconName } from "@/components/art";
import { HOME_LOCATION_ID, useShopLocations } from "@/lib/shop-locations";

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

interface MenuFile extends Menu {
  byLocation?: Record<string, Menu>;
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

function readFile(): MenuFile {
  try {
    const raw = cloudStorage.getItem(KEY);
    if (!raw) return { haircut: defaultHaircut, treatments: [] };
    const parsed = JSON.parse(raw) as Partial<MenuFile>;
    const byLocation: Record<string, Menu> = {};
    if (parsed.byLocation && typeof parsed.byLocation === "object") {
      for (const [id, menu] of Object.entries(parsed.byLocation)) {
        if (menu) byLocation[id] = menuFrom(menu);
      }
    }
    return { ...menuFrom(parsed), byLocation };
  } catch {
    return { haircut: defaultHaircut, treatments: [] };
  }
}

function read(locationId = HOME_LOCATION_ID): Menu {
  const file = readFile();
  if (!locationId || locationId === HOME_LOCATION_ID) return { haircut: file.haircut, treatments: file.treatments };
  return file.byLocation?.[locationId] ?? { haircut: defaultHaircut, treatments: [] };
}

function write(next: MenuFile) {
  cloudStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(EVENT));
}

/** New shops start with the same haircut and other services as the first shop. */
export function copyMenuToLocation(locationId: string) {
  if (!locationId || locationId === HOME_LOCATION_ID) return;
  const file = readFile();
  const copy: Menu = {
    haircut: { ...file.haircut },
    treatments: file.treatments.map((t) => ({ ...t })),
  };
  write({ ...file, byLocation: { ...file.byLocation, [locationId]: copy } });
}

export function useShopMenu(explicitId?: string) {
  const loc = useShopLocations();
  const scope = explicitId || (loc.enabled && loc.scopeId ? loc.scopeId : HOME_LOCATION_ID);
  const [menu, setMenu] = useState<Menu>({ haircut: defaultHaircut, treatments: [] });
  useEffect(() => {
    const pull = () => setMenu(read(scope));
    pull();
    window.addEventListener(EVENT, pull);
    window.addEventListener("storage", pull);
    return () => {
      window.removeEventListener(EVENT, pull);
      window.removeEventListener("storage", pull);
    };
  }, [scope]);

  const saveHaircut = (haircut: ShopHaircut) => {
    const file = readFile();
    if (!scope || scope === HOME_LOCATION_ID) {
      const next = { ...file, haircut };
      setMenu({ haircut, treatments: file.treatments });
      write(next);
      return;
    }
    const current = file.byLocation?.[scope] ?? { haircut: defaultHaircut, treatments: [] };
    const saved = { ...current, haircut };
    setMenu(saved);
    write({ ...file, byLocation: { ...file.byLocation, [scope]: saved } });
  };

  const saveTreatments = (treatments: ShopTreatment[]) => {
    const file = readFile();
    if (!scope || scope === HOME_LOCATION_ID) {
      const next = { ...file, treatments };
      setMenu({ haircut: file.haircut, treatments });
      write(next);
      return;
    }
    const current = file.byLocation?.[scope] ?? { haircut: defaultHaircut, treatments: [] };
    const saved = { ...current, treatments };
    setMenu(saved);
    write({ ...file, byLocation: { ...file.byLocation, [scope]: saved } });
  };

  return { haircut: menu.haircut, treatments: menu.treatments, saveHaircut, saveTreatments };
}

export function blankTreatment(): ShopTreatment {
  return {
    id: `tx-${Date.now().toString(36)}`,
    name: "",
    durationMins: 15,
    icon: "razor",
  };
}
