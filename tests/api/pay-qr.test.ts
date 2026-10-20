import { describe, expect, it } from "vitest";
import { payChoices } from "@/components/qr/pay-choices";
import type { PublicShop } from "@/components/qr/use-public-shop";

const shop = (payQr?: PublicShop["payQr"]) => ({ payQr } as PublicShop);

describe("booking pay options", () => {
  it("offers Cash and GCash by default", () => {
    expect(payChoices(shop())).toEqual(["cash", "gcash"]);
    expect(payChoices(null)).toEqual(["cash", "gcash"]);
  });
  it("adds Maya only when the shop uploaded a Maya QR", () => {
    expect(payChoices(shop({ gcash: null, maya: null }))).toEqual(["cash", "gcash"]);
    expect(payChoices(shop({ gcash: null, maya: "https://x/maya.png" }))).toEqual(["cash", "gcash", "maya"]);
  });
});
