"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { Tier } from "@/data";

export const TIER_COOKIE = "bp_demo_tier";

/** Features gated by tier (plan §3.4). Partner (free) = River Mobile verification only. */
export type Feature =
  | "dashboard" | "queue" | "sales" | "customers" | "barbers" | "vouchers" | "messages" | "kiosk" | "settings" | "partner_app";

const PARTNER_FEATURES: ReadonlySet<Feature> = new Set(["partner_app", "settings"]);
export const canUse = (tier: Tier, f: Feature) => tier === "paid" || PARTNER_FEATURES.has(f);

interface TierCtx { tier: Tier; setTier: (t: Tier) => void; can: (f: Feature) => boolean }
const Ctx = createContext<TierCtx | null>(null);

/** Demo-only tier switch. In production the tier comes from the shop subscription and is enforced server-side. */
export function TierProvider({ initialTier, children }: { initialTier: Tier; children: ReactNode }) {
  const [tier, set] = useState<Tier>(initialTier);
  const setTier = useCallback((t: Tier) => {
    set(t);
    document.cookie = `${TIER_COOKIE}=${t}; path=/; max-age=31536000; samesite=lax`;
  }, []);
  return <Ctx.Provider value={{ tier, setTier, can: (f) => canUse(tier, f) }}>{children}</Ctx.Provider>;
}

export function useTier() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTier must be used inside <TierProvider>");
  return v;
}
