import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { addServicePatch, addedServices, newWalkIn, removeServicePatch, serviceLine } from "@/lib/walkin-visit";
import { dayTotals, ownerDayTotal, visitSplit } from "@/lib/counts";
import { menuAmount } from "@/lib/menu-amount";

const haircut = { id: "haircut", name: "Haircut", price: 200 };
const beard = { id: "beard", name: "Beard trim", price: 100 };
const wash = { id: "wash", name: "Hair wash", price: 50 };

describe("v1.0.31 walk-in auto-start", () => {
  it("creates the walk-in with the shop's Haircut and price", () => {
    const r = newWalkIn({ shopId: "s1", ref: "BK-1", haircut, at: 1000 });
    expect(r).toMatchObject({ id: expect.stringMatching(/^wk-1000-\w+$/), channel: "walk-in", serviceId: "haircut", serviceName: "Haircut", price: 20000, payWhere: "shop", paid: false });
  });
  it("screen seats it straight into the chair (timer starts) with no picker or Accept step", () => {
    const s = readFileSync("src/features/barber/barber-link-screen.tsx", "utf8");
    expect(s).toContain("seatWalkInOnChair(newWalkIn(");
    expect(s).not.toContain("setAdding(");
    expect(s).not.toContain("Other services");
    expect(s).toContain("Add service");
    expect(s).toContain("Add other service");
  });
});

describe("v1.0.31 add service on the live visit", () => {
  const base = newWalkIn({ shopId: "s1", ref: "BK-1", haircut, at: 1000 });
  const one = { ...base, ...addServicePatch(base, beard) };
  const two = { ...one, ...addServicePatch(one, wash) };
  it("adds name and amount, matches the menu (server) amount", () => {
    expect(one.serviceName).toBe("Haircut · Beard trim");
    expect(one.price).toBe(30000);
    expect(serviceLine(two, "")).toBe("Haircut + Beard trim + Hair wash");
    expect(addedServices(two)).toEqual(["Beard trim", "Hair wash"]);
    expect(menuAmount([haircut, beard, wash], two.serviceName)).toBe(two.price);
  });
  it("removes an added service but never the haircut", () => {
    const back = { ...two, ...removeServicePatch(two, beard) };
    expect(back).toMatchObject({ serviceName: "Haircut · Hair wash", price: 25000 });
    expect(removeServicePatch(base, haircut)).toEqual({ serviceName: "Haircut", price: 20000 });
  });
  it("split and counts include added services; still one haircut", () => {
    const chairs = [{ id: "c1", barberId: "b1", locationId: "home", sharePct: 40, shareSet: true }];
    const done = { ...one, status: "done", completedAt: Date.UTC(2026, 9, 31, 4), barberId: "b1", locationId: "home", splitPct: 40 };
    const sp = visitSplit(done, chairs);
    expect(sp).toMatchObject({ price: 30000, barber: 12000, owner: 18000 });
    const owner = ownerDayTotal([done], chairs, "2026-10-31");
    expect(owner).toMatchObject({ haircuts: 1, sales: 30000, barber: 12000, owner: 18000 });
    const mine = [...dayTotals([done], chairs, "2026-10-31").values()][0];
    expect(mine).toMatchObject({ haircuts: 1, sales: 30000, barber: 12000 });
  });
});
