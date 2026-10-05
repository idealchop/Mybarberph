"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Tier } from "@/data";
import { getRepository } from "@/data";
import { canUse, TIER_COOKIE, type Feature } from "./tier-shared";

export type { Feature } from "./tier-shared";

interface TierCtx {
  tier: Tier;
  setTier: (t: Tier) => void;
  can: (f: Feature) => boolean;
  /** Sync UI from Firestore shop.tier (layouts call this). */
  syncFromShop: (t: Tier) => void;
}
const Ctx = createContext<TierCtx | null>(null);

/**
 * Plan gate. Product routes sync from shop.tier via SyncShopTier.
 * setTier persists to Firestore (not a demo cookie). Cookie is only kept
 * as a soft cache for first paint / demo launcher.
 */
export function TierProvider({ initialTier, children }: { initialTier: Tier; children: ReactNode }) {
  const [tier, set] = useState<Tier>(initialTier);

  useEffect(() => { set(initialTier); }, [initialTier]);

  const syncFromShop = useCallback((t: Tier) => {
    set(t);
    document.cookie = `${TIER_COOKIE}=${t}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  const setTier = useCallback((t: Tier) => {
    set(t);
    document.cookie = `${TIER_COOKIE}=${t}; path=/; max-age=31536000; samesite=lax`;
    void getRepository().updateShopTier(t).catch(() => {
      /* offline / mock — cookie + local state still apply */
    });
  }, []);

  return (
    <Ctx.Provider value={{ tier, setTier, can: (f) => canUse(tier, f), syncFromShop }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTier() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTier must be used inside <TierProvider>");
  return v;
}

/** Call from shop/partner layouts once shop is loaded. */
export function SyncShopTier({ tier }: { tier: Tier }) {
  const { syncFromShop } = useTier();
  useEffect(() => { syncFromShop(tier); }, [tier, syncFromShop]);
  return null;
}
