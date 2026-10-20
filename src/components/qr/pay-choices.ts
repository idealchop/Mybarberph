import type { PublicShop } from "./use-public-shop";

export type PayChoice = "cash" | "gcash" | "maya";

/** Booking pay choices: Cash and GCash always; Maya only when the shop has uploaded a Maya QR. */
export function payChoices(shop: Pick<PublicShop, "payQr"> | null | undefined): PayChoice[] {
  return shop?.payQr?.maya ? ["cash", "gcash", "maya"] : ["cash", "gcash"];
}
