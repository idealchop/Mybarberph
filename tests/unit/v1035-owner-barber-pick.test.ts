import { describe, expect, it } from "vitest";
import { activeBarbersAt, NO_BARBER_MESSAGE, ownerBarberChoice, resolveOwnerBarber } from "@/lib/owner-barber-pick";

const chairs = [
  { id: "c-eddie", label: "Eddie Emperador", barberId: "b-eddie", barberName: "Eddie Emperador", locationId: "home" },
  { id: "c-ray", label: "Raymond Dias", barberId: "b-ray", barberName: "Raymond Dias", locationId: "home" },
  { id: "c-off", label: "Off", barberId: "b-off", barberName: "Off Barber", locationId: "home", active: false },
  { id: "c-empty", label: "Barber 4", barberId: "", barberName: "", locationId: "home" },
  { id: "c-n", label: "Nel", barberId: "b-nel", barberName: "Nel Gorobat", locationId: "loc-dita" },
];

describe("v1.0.35 owner picks the barber for a walk-in or record", () => {
  it("lists only active barbers with a barber set up at that location", () => {
    expect(activeBarbersAt(chairs, "home").map((b) => b.barberId)).toEqual(["b-eddie", "b-ray"]);
    expect(activeBarbersAt(chairs, "loc-dita").map((b) => b.name)).toEqual(["Nel Gorobat"]);
  });
  it("several barbers: owner must pick one of them", () => {
    const c = ownerBarberChoice(activeBarbersAt(chairs, "home"));
    expect(c.kind).toBe("pick");
    expect(resolveOwnerBarber(c, "")).toBeNull();
    expect(resolveOwnerBarber(c, "b-nel")).toBeNull();
    expect(resolveOwnerBarber(c, "b-ray")?.name).toBe("Raymond Dias");
  });
  it("one barber: assigned automatically, no question", () => {
    const c = ownerBarberChoice(activeBarbersAt(chairs, "loc-dita"));
    expect(c.kind).toBe("auto");
    expect(resolveOwnerBarber(c, "")?.barberId).toBe("b-nel");
  });
  it("no barber: nothing to save under, clear message without 'chair'", () => {
    const c = ownerBarberChoice(activeBarbersAt(chairs, "loc-none"));
    expect(c.kind).toBe("none");
    expect(resolveOwnerBarber(c, "b-eddie")).toBeNull();
    expect(NO_BARBER_MESSAGE.toLowerCase()).not.toContain("chair");
  });
});
