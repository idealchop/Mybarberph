import type { Tier } from "@/data";

/** Shared by server (root layout reads the cookie) and client (TierProvider writes it). Not a client module. */
export const TIER_COOKIE = "bp_demo_tier";

/** Features gated by tier (plan §3.4). Partner (free) = River Mobile verification only. */
export type Feature =
  | "dashboard" | "queue" | "sales" | "customers" | "barbers" | "vouchers" | "messages" | "kiosk" | "settings" | "partner_app";

const PARTNER_FEATURES: ReadonlySet<Feature> = new Set(["partner_app", "settings"]);
export const canUse = (tier: Tier, f: Feature) => tier === "paid" || PARTNER_FEATURES.has(f);

export function parseTier(v: string | undefined): Tier { return v === "partner" ? "partner" : "paid"; }
