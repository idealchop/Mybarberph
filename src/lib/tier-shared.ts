import type { Tier } from "@/data";

/** Features gated by tier. Partner (free) = River Mobile bookings, queue, community, settings. */
export type Feature =
  | "dashboard" | "queue" | "sales" | "customers" | "barbers" | "vouchers" | "messages" | "kiosk" | "settings" | "partner_app";

const PARTNER_FEATURES: ReadonlySet<Feature> = new Set(["partner_app", "settings"]);
export const canUse = (tier: Tier, f: Feature) => tier === "paid" || PARTNER_FEATURES.has(f);
