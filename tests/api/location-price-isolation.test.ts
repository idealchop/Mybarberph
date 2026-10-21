import { describe, expect, it } from "vitest";
import { setBranchPrice } from "@/lib/location-prices";
import { menuFor, publicShop, type ShopDoc } from "@/lib/server/shops";

type B = { id: string; name: string; priceOverrides?: Record<string, number> };
const branches = (): B[] => [
  { id: "home", name: "Bayan", priceOverrides: { haircut: 140 } },
  { id: "loc-niugan", name: "Niugan" },
  { id: "loc-dita", name: "Dita", priceOverrides: { haircut: 125, "t-shave": 90 } },
  { id: "loc-sala", name: "Sala" },
];

describe("per-location price save only touches that location", () => {
  it("setting Niugan leaves every other location exactly as it was, and doesn't mutate the input", () => {
    const before = branches();
    const snap = JSON.stringify(before);
    const after = setBranchPrice(before, "loc-niugan", "haircut", "115", 140);
    expect(JSON.stringify(before)).toBe(snap);
    expect(after.find((b) => b.id === "loc-niugan")!.priceOverrides).toEqual({ haircut: 115 });
    for (const id of ["home", "loc-dita", "loc-sala"]) expect(after.find((b) => b.id === id)).toEqual(before.find((b) => b.id === id));
  });
  it("blank resets only that location and keeps its other services", () => {
    const after = setBranchPrice(branches(), "loc-dita", "haircut", "", 115);
    expect(after.find((b) => b.id === "loc-dita")!.priceOverrides).toEqual({ "t-shave": 90 });
    expect(after.find((b) => b.id === "home")!.priceOverrides).toEqual({ haircut: 140 });
  });
  it("a default price change moves only locations without their own price; the main shop's own price applies to visits with no location", () => {
    const mk = (def: number) => ({ menu: [{ id: "haircut", name: "Haircut", durationMins: 30, price: def, kind: "haircut" }], branches: [
      { id: "home", name: "Bayan", address: "", area: "", location: null, priceOverrides: { haircut: 14000 } },
      { id: "loc-niugan", name: "Niugan", address: "", area: "", location: null, priceOverrides: { haircut: 11500 } },
      { id: "loc-sala", name: "Sala", address: "", area: "", location: null },
    ] }) as unknown as ShopDoc;
    const s = mk(16000);
    expect(menuFor(s, "loc-niugan")[0]!.price).toBe(11500);
    expect(menuFor(s, "loc-sala")[0]!.price).toBe(16000);
    expect(menuFor(s, undefined)[0]!.price).toBe(14000);
    const pub = publicShop("x", s);
    expect(Object.keys(pub.servicesByLocation).sort()).toEqual(["home", "loc-niugan"]);
  });
});
