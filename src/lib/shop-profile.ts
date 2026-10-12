"use client";

import { useEffect, useState } from "react";
import { shop as seed } from "@/data";

export interface ShopLocation {
  lat: number;
  lng: number;
  formattedAddress: string;
  placeId?: string;
}

export interface ShopProfile {
  name: string;
  address: string;
  phone: string;
  /** Short "barangay, city" from the map pin. */
  area: string;
  about: string;
  location: ShopLocation | null;
  photoUrls: string[];
  /** Round mark shown with the shop name. */
  logoUrl: string;
  /** Shops this owner runs. Shown on the profile. */
  locations: number;
}

const KEY = "barbers.shop-profile";

/** 28 J.P. Rizal, Concepcion Uno, Marikina — the shop's starting pin. */
const SHOP_PIN: ShopLocation = {
  lat: 14.658031,
  lng: 121.103906,
  formattedAddress: seed.address,
};

export const shopDefaults: ShopProfile = {
  name: seed.name,
  address: seed.address,
  phone: seed.phone,
  area: "Concepcion Uno, Marikina",
  about: "",
  location: SHOP_PIN,
  photoUrls: [],
  logoUrl: "",
  locations: 1,
};

export function useShopProfile() {
  const [profile, setProfile] = useState<ShopProfile>(shopDefaults);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<ShopProfile>;
        setProfile({
          ...shopDefaults,
          ...saved,
          location: saved.location === undefined ? shopDefaults.location : saved.location,
          photoUrls: Array.isArray(saved.photoUrls) ? saved.photoUrls : [],
          logoUrl: typeof saved.logoUrl === "string" ? saved.logoUrl : "",
          locations: clampLocations(saved.locations),
        });
      }
    } catch {
      setProfile(shopDefaults);
    }
    setReady(true);
  }, []);
  const save = (next: ShopProfile) => {
    const stored: ShopProfile = { ...next, photoUrls: next.photoUrls.slice(0, 6), locations: clampLocations(next.locations) };
    window.localStorage.setItem(KEY, JSON.stringify(stored));
    setProfile(stored);
  };
  return { profile, ready, save };
}

export function clampLocations(value: unknown) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(99, n);
}

export function locationCountLabel(count: number) {
  const n = clampLocations(count);
  return n === 1 ? "1 location" : `${n} locations`;
}

export function shopHandle(name: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 18);
  return `@${slug || "barbersph"}`;
}

export function useGreeting() {
  const [greeting, setGreeting] = useState("Good evening");
  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");
  }, []);
  return greeting;
}
