import { describe, expect, it } from "vitest";
import { applyOverrides, cleanOverrides, draftToOverrides, priceAt, toCentavos } from "@/lib/location-prices";
import { menuFor, type ShopDoc } from "@/lib/server/shops";

const menu = [
  { id: "haircut", name: "Haircut", durationMins: 30, price: 15000, kind: "haircut" as const },
  { id: "t-shave", name: "Shave", durationMins: 15, price: 8000, kind: "treatment" as const },
];

describe("location prices", () => {
  it("cleans overrides: drops blanks, negatives, junk ids and non-numbers", () => {
    expect(cleanOverrides({ haircut: "180", "t-shave": "", bad: -1, "x y": 5, n: "abc", z: null })).toEqual({ haircut: 180 });
    expect(cleanOverrides(null)).toEqual({});
    expect(cleanOverrides({ a: 0 })).toEqual({ a: 0 });
  });
  it("priceAt falls back to the default", () => {
    expect(priceAt(menu[0], { haircut: 20000 })).toBe(20000);
    expect(priceAt(menu[1], { haircut: 20000 })).toBe(8000);
    expect(priceAt(menu[1], undefined)).toBe(8000);
  });
  it("applyOverrides keeps order and untouched items", () => {
    const out = applyOverrides(menu, { "t-shave": 9500 });
    expect(out.map((m) => m.price)).toEqual([15000, 9500]);
    expect(out[0]).toBe(menu[0]);
    expect(applyOverrides(menu, {})).toBe(menu);
  });
  it("toCentavos", () => expect(toCentavos({ haircut: 180.5 })).toEqual({ haircut: 18050 }));
  it("menuFor applies that location's prices only", () => {
    const shop = { menu, branches: [{ id: "b1", name: "Two", address: "", area: "", location: null, priceOverrides: { haircut: 20000 } }, { id: "home", name: "One", address: "", area: "", location: null }] } as unknown as ShopDoc;
    expect(menuFor(shop, "b1")[0].price).toBe(20000);
    expect(menuFor(shop, "home")[0].price).toBe(15000);
    expect(menuFor(shop, null)[0].price).toBe(15000);
    expect(menuFor(shop, "missing")[1].price).toBe(8000);
  });
  it("editor draft: blank or same as default means default", () => {
    const d = [{ id: "haircut", price: 150 }, { id: "t-shave", price: 80 }];
    expect(draftToOverrides({ haircut: "150", "t-shave": "95" }, d)).toEqual({ "t-shave": 95 });
    expect(draftToOverrides({ haircut: " " }, d)).toEqual({});
  });
});
