"use client";
import { entitledPlan } from "@/lib/entitlements";
import { useEffect, useState } from "react";
import { useCloud } from "@/lib/cloud";
import { manilaDay } from "@/lib/chair-bookings";
import { walkInLimit, WALKIN_LIMIT_MESSAGE } from "@/lib/plans";

/**
 * Partner shops: 10 walk-ins per Manila day per shop (owner app and chair links together).
 * The server enforces it; this mirrors the count for the screen. Paid plans: unlimited.
 */
export function useWalkInAllowance(locationId: string) {
  const cloud = useCloud();
  const limit = walkInLimit(entitledPlan(cloud.shop?.plan));
  const [today] = useState(() => manilaDay(Date.now()));
  const used = cloud.bookings.filter((b) => b.channel === "walk-in" && (b.locationId || "home") === (locationId || "home") && manilaDay(b.createdAt) === today).length;
  const [refused, setRefused] = useState("");
  useEffect(() => {
    const on = (e: Event) => setRefused(String((e as CustomEvent).detail || WALKIN_LIMIT_MESSAGE));
    window.addEventListener("barbers-walkin-limit", on);
    return () => window.removeEventListener("barbers-walkin-limit", on);
  }, []);
  const unlimited = !Number.isFinite(limit);
  const left = unlimited ? Infinity : Math.max(0, limit - used);
  return {
    unlimited, used, limit, left,
    atLimit: !unlimited && (left <= 0 || Boolean(refused)),
    label: unlimited ? "" : `${left} of ${limit} walk-ins left today`,
    message: refused || WALKIN_LIMIT_MESSAGE,
  };
}
