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

import { draftFromBranches, effectivePrice, planLocationSave } from "@/lib/location-prices";
const saveWith = (list: B[], oldDef: number, newDef: number, edits: Record<string, string>) => {
  const initial = draftFromBranches(list, "haircut", oldDef);
  const changes = planLocationSave(list, "haircut", oldDef, newDef, { ...initial, ...edits }, initial);
  return { changes, saved: changes.reduce((l, c) => setBranchPrice(l, c.id, "haircut", c.value, newDef), list) };
};

describe("Edit service › Save writes only what it must", () => {
  it("boxes show each location's real price; untouched boxes with the same default are not written", () => {
    const list = branches();
    expect(draftFromBranches(list, "haircut", 115)).toEqual({ home: "140", "loc-niugan": "115", "loc-dita": "125", "loc-sala": "115" });
    expect(saveWith(list, 115, 115, {}).changes).toEqual([]);
  });
  it("HARD RULE: bulk price for selected locations changes only those; every other location stays byte-identical", () => {
    const list = [...branches(), { id: "loc-x", name: "X", priceOverrides: { "t-shave": 70 } } as B];
    const before = list.map((b) => JSON.stringify(b));
    const { changes, saved } = saveWith(list, 115, 115, { "loc-niugan": "130", "loc-x": "130" });
    expect(changes.map((c) => c.id)).toEqual(["loc-niugan", "loc-x"]);
    saved.forEach((b, i) => { if (!["loc-niugan", "loc-x"].includes(b.id)) expect(JSON.stringify(b)).toBe(before[i]); });
    expect(saved.find((b) => b.id === "loc-x")!.priceOverrides).toEqual({ "t-shave": 70, haircut: 130 });
    expect(list.map((b) => JSON.stringify(b))).toEqual(before);
  });
  it("HARD RULE: default 115 → 20 with 1 location selected: only that location's effective price changes", () => {
    const list = branches();
    const was = Object.fromEntries(list.map((b) => [b.id, effectivePrice(b, "haircut", 115)]));
    const { saved } = saveWith(list, 115, 20, { "loc-sala": "" }); // Sala selected → "Use the default price"
    const now = Object.fromEntries(saved.map((b) => [b.id, effectivePrice(b, "haircut", 20)]));
    expect(now["loc-sala"]).toBe(20);
    for (const id of ["home", "loc-niugan", "loc-dita"]) expect(now[id]).toBe(was[id]);
    expect(saved.find((b) => b.id === "loc-niugan")!.priceOverrides).toEqual({ haircut: 115 });
    expect(saved.find((b) => b.id === "loc-dita")).toEqual(list[2]);
  });
  it("default change with nothing selected changes no location's price", () => {
    const list = branches();
    const { saved } = saveWith(list, 115, 20, {});
    saved.forEach((b, i) => expect(effectivePrice(b, "haircut", 20)).toBe(effectivePrice(list[i]!, "haircut", 115)));
  });
});

describe("Edit service › Apply to all", () => {
  const applyAll = (list: B[], v: number) => Object.fromEntries(list.map((b) => [b.id, String(v)]));
  it("Apply to all changes every location and the base price; Save stores it everywhere", () => {
    const list = branches();
    const { saved } = saveWith(list, 115, 130, applyAll(list, 130));
    for (const b of saved) expect(effectivePrice(b, "haircut", 130)).toBe(130);
    expect(saved.find((b) => b.id === "loc-dita")!.priceOverrides).toEqual({ "t-shave": 90 });
  });
  it("an individual edit after Apply to all wins for that location only", () => {
    const list = branches();
    const { saved } = saveWith(list, 115, 130, { ...applyAll(list, 130), "loc-sala": "99" });
    const eff = Object.fromEntries(saved.map((b) => [b.id, effectivePrice(b, "haircut", 130)]));
    expect(eff).toEqual({ home: 130, "loc-niugan": 130, "loc-dita": 130, "loc-sala": 99 });
  });
  it("without Apply to all, the base stays and untouched locations are not written", () => {
    const list = branches();
    const before = list.map((b) => JSON.stringify(b));
    const { changes, saved } = saveWith(list, 115, 115, { "loc-niugan": "125" });
    expect(changes.map((c) => c.id)).toEqual(["loc-niugan"]);
    saved.forEach((b, i) => { if (b.id !== "loc-niugan") expect(JSON.stringify(b)).toBe(before[i]); });
  });
});
