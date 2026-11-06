import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeFirestore } from "../stubs/fake-firestore";

const fs = fakeFirestore();
vi.mock("@/lib/firebase/admin", () => ({ adminDb: () => fs, adminAuth: () => ({}) }));
const { putState, chairLink } = await import("@/lib/server/shops");
const { GET } = await import("@/app/api/barber/[token]/route");

const KEITH = "keithtoken1";
const JUN = "juntoken12345";
const PAST = Date.parse("2020-01-01T00:00:00Z");
const keith = () => ({ id: "c1", label: "Keith", barberId: "b-keith", barberName: "Keith", linkToken: KEITH, linkReviewAt: PAST, active: true, number: 1 });
const jun = () => ({ id: "c2", label: "Jun", barberId: "b-jun", barberName: "Jun", linkToken: JUN, active: true, number: 2 });

beforeEach(() => {
  for (const k of Object.keys(fs.store)) delete fs.store[k];
  fs.store["shops/shop-a"] = { name: "Shop A", menu: [] };
  fs.store["shops/shop-a/bookings/keith-done"] = { id: "keith-done", shopId: "shop-a", status: "done", barberId: "b-keith", createdAt: 10, updatedAt: 10, price: 100 };
  fs.store["shops/shop-a/bookings/jun-done"] = { id: "jun-done", shopId: "shop-a", status: "done", barberId: "b-jun", createdAt: 11, updatedAt: 11, price: 100 };
  fs.store["chairLinks/othertoken1"] = { shopId: "shop-b", chairId: "c9", expiresAt: PAST };
});

const save = (chairs: unknown[]) => putState("shop-a", "barbers.shop-chairs", JSON.stringify(chairs));
const open = (token: string) => GET(new Request("http://local"), { params: Promise.resolve({ token }) } as never);

describe("Barber link mirror (links never expire; turn-off is the off switch)", () => {
  it("TC-LINK-HP-05 an overdue review keeps the link, drops legacy expiresAt, and does not touch another shop", async () => {
    await save([{ ...keith(), linkExpiresAt: PAST }, jun()]);
    expect(await chairLink(KEITH)).toEqual({ shopId: "shop-a", chairId: "c1" });
    expect(fs.store[`chairLinks/${KEITH}`]).toEqual({ shopId: "shop-a", chairId: "c1" });
    expect(await chairLink(JUN)).toEqual({ shopId: "shop-a", chairId: "c2" });
    expect(fs.store["chairLinks/othertoken1"]).toEqual({ shopId: "shop-b", chairId: "c9", expiresAt: PAST });
    const res = await open(KEITH);
    expect(res.status).toBe(200);
    const ids = ((await res.json()).bookings as { id: string }[]).map((b) => b.id);
    expect(ids).toContain("keith-done");
    expect(ids).not.toContain("jun-done");
  });

  it("TC-LINK-NEG-05 turning one barber off deletes only that link; turning them back on restores the same token", async () => {
    await save([keith(), jun()]);
    await save([{ ...keith(), active: false }, jun()]);
    expect(await chairLink(KEITH)).toBeNull();
    expect(await chairLink(JUN)).toEqual({ shopId: "shop-a", chairId: "c2" });
    const stored = JSON.parse(fs.store["shops/shop-a/private/chairs"]!.json as string) as { id: string; linkToken?: string }[];
    expect(stored.find((c) => c.id === "c1")?.linkToken).toBe(KEITH);
    const off = await open(KEITH);
    expect(off.status).toBe(404);
    expect(await off.json()).toMatchObject({ code: "not_found", error: "This link was replaced or turned off." });
    await save([keith(), jun()]);
    expect(await chairLink(KEITH)).toEqual({ shopId: "shop-a", chairId: "c1" });
    expect((await open(JUN)).status).toBe(200);
  });

  it("TC-LINK-NEG-06 removing a barber deletes that link only; a token that fails the pattern is not published", async () => {
    await save([keith(), jun()]);
    await save([jun(), { id: "c3", label: "Short", barberId: "b-short", barberName: "Short", linkToken: "abc", active: true, number: 3 }]);
    expect(await chairLink(KEITH)).toBeNull();
    expect(await chairLink(JUN)).toEqual({ shopId: "shop-a", chairId: "c2" });
    expect(fs.store["chairLinks/abc"]).toBeUndefined();
    expect(fs.store["chairLinks/othertoken1"]?.shopId).toBe("shop-b");
  });
});
