"use client";
import { cloudStorage } from "@/lib/cloud";

import { useEffect, useState } from "react";
import type { ShopLocation, ShopProfile } from "@/lib/shop-profile";

/** The shop that already existed before multiple shops was turned on. */
export const HOME_LOCATION_ID = "home";
/** Combined day for every shop. */
export const ALL_LOCATIONS = "all";

export interface ShopBranch {
  id: string;
  /** Short place name, such as Concepcion Uno. */
  name: string;
  area: string;
  address: string;
  phone: string;
  about: string;
  location: ShopLocation | null;
  photoUrls: string[];
  /** This location's own service prices in pesos ({ serviceId: price }); missing = default. */
  priceOverrides?: Record<string, number>;
}

interface Store {
  enabled: boolean;
  viewId: string;
  branches: ShopBranch[];
}

const KEY = "barbers.shop-locations";
const EVENT = "barbers-locations";
const CHAIRS_KEY = "barbers.shop-chairs";

const EMPTY: Store = { enabled: false, viewId: HOME_LOCATION_ID, branches: [] };

function placeName(profile: ShopProfile) {
  const area = profile.area.trim();
  const short = area.split(",")[0]?.trim();
  return short || profile.name;
}

function homeBranch(profile: ShopProfile): ShopBranch {
  return {
    id: HOME_LOCATION_ID,
    name: placeName(profile),
    area: profile.area,
    address: profile.address,
    phone: profile.phone,
    about: profile.about,
    location: profile.location,
    photoUrls: [],
  };
}

export function readLocationStore(): Store {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = cloudStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Store>;
    const branches = Array.isArray(parsed.branches) ? parsed.branches.filter((b) => b && b.id && b.name) : [];
    return {
      enabled: Boolean(parsed.enabled),
      viewId: typeof parsed.viewId === "string" && parsed.viewId ? parsed.viewId : HOME_LOCATION_ID,
      branches,
    };
  } catch {
    return EMPTY;
  }
}

function writeStore(next: Store) {
  cloudStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(EVENT));
}

/** Existing chairs and visits stay on the first shop. */
function stampHome(key: string) {
  try {
    const raw = cloudStorage.getItem(key);
    if (!raw) return;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return;
    let dirty = false;
    const next = parsed.map((item) => {
      if (item && typeof item === "object" && !("locationId" in item && (item as { locationId?: string }).locationId)) {
        dirty = true;
        return { ...item, locationId: HOME_LOCATION_ID };
      }
      return item;
    });
    if (dirty) cloudStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* leave the list as it is */
  }
}

export function enableMultipleShops(profile: ShopProfile) {
  const store = readLocationStore();
  const fresh = homeBranch(profile);
  const existing = store.branches.find((b) => b.id === HOME_LOCATION_ID);
  const home: ShopBranch = existing
    ? { ...existing, area: fresh.area, address: fresh.address, location: fresh.location, phone: fresh.phone, about: fresh.about }
    : fresh;
  const rest = store.branches.filter((b) => b.id !== HOME_LOCATION_ID);
  const branches = [home, ...rest];
  const viewId = branches.some((b) => b.id === store.viewId) ? store.viewId : HOME_LOCATION_ID;
  writeStore({ enabled: true, viewId, branches });
  stampHome(CHAIRS_KEY);
  window.dispatchEvent(new Event("barbers-chairs"));
  window.dispatchEvent(new Event("barbers-bookings"));
}

export function disableMultipleShops() {
  const store = readLocationStore();
  writeStore({ ...store, enabled: false, viewId: HOME_LOCATION_ID });
}

export function setLocationView(viewId: string) {
  const store = readLocationStore();
  writeStore({ ...store, viewId });
}

export function addBranch(input: { name: string; address: string; area: string; location: ShopLocation | null }): { branch?: ShopBranch; error?: string } {
  const name = input.name.trim();
  if (name.length < 2) return { error: "Enter the shop name." };
  const store = readLocationStore();
  if (store.branches.some((b) => b.name.toLowerCase() === name.toLowerCase())) return { error: `${name} is already a shop.` };
  const branch: ShopBranch = {
    id: `loc-${Date.now().toString(36)}`,
    name,
    address: input.address,
    area: input.area || input.address,
    phone: "",
    about: "",
    location: input.location,
    photoUrls: [],
  };
  writeStore({ ...store, enabled: true, branches: [...store.branches, branch] });
  return { branch };
}

export function updateBranch(id: string, patch: Partial<Omit<ShopBranch, "id">>) {
  const store = readLocationStore();
  writeStore({
    ...store,
    branches: store.branches.map((b) => b.id === id ? { ...b, ...patch, id } : b),
  });
}

export function removeBranch(id: string): string {
  if (id === HOME_LOCATION_ID) return "The first shop stays.";
  const store = readLocationStore();
  writeStore({
    ...store,
    viewId: store.viewId === id ? HOME_LOCATION_ID : store.viewId,
    branches: store.branches.filter((b) => b.id !== id),
  });
  return "";
}

export function branchName(branches: ShopBranch[], locationId?: string) {
  const id = locationId || HOME_LOCATION_ID;
  return branches.find((b) => b.id === id)?.name ?? "";
}

/** True when this visit belongs on the shop currently open. */
export function inLocation(locationId: string | undefined, enabled: boolean, viewingAll: boolean, scopeId: string | null) {
  const id = locationId || HOME_LOCATION_ID;
  if (!enabled) return id === HOME_LOCATION_ID;
  if (viewingAll || scopeId === null) return true;
  return id === scopeId;
}

export function useShopLocations() {
  const [store, setStore] = useState<Store>(EMPTY);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const pull = () => setStore(readLocationStore());
    pull();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial sync from the shared client store; later updates arrive via the subscribed events
    setReady(true);
    window.addEventListener(EVENT, pull);
    window.addEventListener("storage", pull);
    return () => {
      window.removeEventListener(EVENT, pull);
      window.removeEventListener("storage", pull);
    };
  }, []);

  const viewingAll = store.enabled && store.viewId === ALL_LOCATIONS;
  const branch = store.branches.find((b) => b.id === store.viewId) ?? null;
  const scopeId = store.enabled ? (viewingAll ? null : (branch?.id ?? HOME_LOCATION_ID)) : HOME_LOCATION_ID;

  return {
    ready,
    enabled: store.enabled,
    branches: store.branches,
    viewId: store.viewId,
    branch,
    viewingAll,
    scopeId,
    setView: setLocationView,
    enable: enableMultipleShops,
    disable: disableMultipleShops,
    addBranch,
    updateBranch,
    removeBranch,
  };
}
