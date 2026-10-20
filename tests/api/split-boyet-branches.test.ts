import { describe, expect, it } from "vitest";
import { plan } from "../../scripts/split-boyet-branches";

const br = (id: string, name: string) => ({ id, name, address: `${name} addr`, location: { lat: 1, lng: 2 } });
const ch = (id: string, locationId: string, number: number) => ({ id, barberName: id, locationId, number, linkToken: `t-${id}` });

describe("split Boyet branches", () => {
  it("splits shared branches into I/II/III, one barber each, copying address and pin", () => {
    const r = plan("Boyet Barbershop", [br("loc-k", "Boyet Barbershop – Katapatan Homes"), br("home", "Boyet Barbershop – Bayan")],
      [ch("a", "loc-k", 1), ch("b", "loc-k", 2), ch("c", "loc-k", 3), ch("d", "home", 4)]);
    expect(r.branches.map((b) => [b.id, b.name])).toEqual([["loc-k", "Katapatan Homes I"], ["loc-k-2", "Katapatan Homes II"], ["loc-k-3", "Katapatan Homes III"], ["home", "Bayan"]]);
    expect(r.branches[1]).toMatchObject({ address: "Boyet Barbershop – Katapatan Homes addr", location: { lat: 1, lng: 2 } });
    expect(r.chairs.map((c) => c.locationId)).toEqual(["loc-k", "loc-k-2", "loc-k-3", "home"]);
    expect(r.chairs.map((c) => c.linkToken)).toEqual(["t-a", "t-b", "t-c", "t-d"]);
  });
  it("folds an existing numbered sibling into the family (prod's 'Hongkong Village II')", () => {
    const r = plan("Boyet Barbershop", [br("loc-h", "Boyet Barbershop – Hong Kong Village"), br("loc-x", "Hongkong Village II")], [ch("r", "loc-h", 1), ch("m", "loc-x", 2)]);
    expect(r.branches.map((b) => [b.id, b.name])).toEqual([["loc-h", "Hong Kong Village I"], ["loc-x", "Hong Kong Village II"]]);
  });
  it("is idempotent", () => {
    const once = plan("Boyet Barbershop", [br("loc-k", "Katapatan Homes")], [ch("a", "loc-k", 1), ch("b", "loc-k", 2)]);
    const twice = plan("Boyet Barbershop", once.branches, once.chairs);
    expect(twice.branches).toEqual(once.branches);
    expect(twice.chairs).toEqual(once.chairs);
  });
});
