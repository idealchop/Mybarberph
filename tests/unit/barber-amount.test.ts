import { describe, expect, it } from "vitest";
import { lockedAmount, menuAmount } from "@/lib/menu-amount";

const menu = [{ name: "Haircut", price: 250 }, { name: "Beard trim", price: 100 }];

describe("Locked barber amount (client mirror of the server rule)", () => {
  it("TC-BARBER-HP-06 menu total from the visit's services, plus a home fee; paid online keeps its amount", () => {
    expect(menuAmount(menu, "Haircut · Beard trim")).toBe(35_000);
    expect(menuAmount(menu, "Hot towel")).toBeNull();
    expect(lockedAmount({ serviceName: "Haircut", price: 24_000 }, menu)).toBe(25_000);
    expect(lockedAmount({ serviceName: "Haircut", price: 0, homeFee: 5_000 }, menu)).toBe(30_000);
    expect(lockedAmount({ serviceName: "Haircut", price: 22_000, paid: true, payWhere: "online", payMethod: "online" }, menu)).toBe(22_000);
  });
});

