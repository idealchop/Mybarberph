"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { Tier } from "@/data";
import { canUse, TIER_COOKIE, type Feature } from "./tier-shared";

export type { Feature } from "./tier-shared";

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
