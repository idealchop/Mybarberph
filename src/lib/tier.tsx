"use client";
import { entitledPlan } from "@/lib/entitlements";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, type ReactNode } from "react";
import type { Tier } from "@/data";
import { useCloud } from "@/lib/cloud";
import { tierForPlan } from "@/lib/plans";
import { canUse, type Feature } from "./tier-shared";

export type { Feature } from "./tier-shared";

interface TierCtx { tier: Tier; plan: string; /** Plan whose features apply (all of them while plan limits are off). */ access: string; setTier: (t: Tier) => void; can: (f: Feature) => boolean }
const Ctx = createContext<TierCtx | null>(null);

/** The shop's plan comes from shops/{shopId}.plan (set by the server after payment). Guests see Partner. */
export function TierProvider({ children }: { children: ReactNode }) {
  const cloud = useCloud();
  const router = useRouter();
  const shop = cloud.shop;
  const plan = shop?.plan ?? "partner";
  const access = entitledPlan(plan);
  const tier = tierForPlan(access);
  /** Upgrades go through billing; the plan is never switched on the device. */
  const setTier = useCallback((t: Tier) => { if (t === "paid") router.push("/settings/billing"); }, [router]);
  return <Ctx.Provider value={{ tier, plan, access, setTier, can: (f) => canUse(tier, f) }}>{children}</Ctx.Provider>;
}

export function useTier() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTier must be used inside <TierProvider>");
  return v;
}
