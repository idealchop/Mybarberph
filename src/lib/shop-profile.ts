"use client";

import { useEffect, useMemo, useState } from "react";
import { cloudStorage, useCloud } from "@/lib/cloud";

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
  /** Opening hours as the shop writes them, e.g. "Mon–Sat 9 AM–8 PM". */
  hours: string;
  /** Tap-to-set hours; `hours` is its formatted line. */
  hoursWeek?: import("@/lib/shop-hours").WeekHours | null;
  /** Owner alert contacts (optional; used once an SMS/email provider is configured). */
  notifyPhone?: string;
  notifyEmail?: string;
}

const KEY = "barbers.shop-profile";

export const shopDefaults: ShopProfile = {
  name: "",
  address: "",
  phone: "",
  area: "",
  about: "",
  location: null,
  photoUrls: [],
  logoUrl: "",
  locations: 1,
  hours: "",
};

function readProfile(): ShopProfile {
  try {
    const raw = cloudStorage.getItem(KEY);
    if (!raw) return shopDefaults;
    const saved = JSON.parse(raw) as Partial<ShopProfile> | null;
    if (!saved) return shopDefaults;
    return {
      ...shopDefaults,
      ...saved,
      location: saved.location ?? null,
      photoUrls: Array.isArray(saved.photoUrls) ? saved.photoUrls : [],
      logoUrl: typeof saved.logoUrl === "string" ? saved.logoUrl : "",
      hours: typeof saved.hours === "string" ? saved.hours : "",
      locations: clampLocations(saved.locations),
    };
  } catch {
    return shopDefaults;
  }
}

/** The signed-in shop's profile. Empty for guests and for new shops. */
export function useShopProfile() {
  const cloud = useCloud();
  const raw = cloud.values[KEY];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const profile = useMemo(() => readProfile(), [raw]);
  const save = (next: ShopProfile) => {
    const stored: ShopProfile = { ...next, photoUrls: next.photoUrls.slice(0, 6), locations: clampLocations(next.locations) };
    cloudStorage.setItem(KEY, JSON.stringify(stored));
  };
  return { profile, ready: cloud.ready, save, signedIn: cloud.mode !== "guest" };
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

/** The owner's shop logo — the one mark used on every location's QR. Falls back to the public shop doc. Empty if none. */
export function useOwnerLogo(): string {
  const { profile } = useShopProfile();
  const cloud = useCloud();
  return profile.logoUrl || cloud.shop?.logoUrl || "";
}
