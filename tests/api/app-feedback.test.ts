import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeFirestore } from "../stubs/fake-firestore";

const fs = fakeFirestore();
vi.mock("@/lib/firebase/admin", () => ({ adminDb: () => fs, adminAuth: () => ({}) }));
let caller: { uid: string } | null = null;
vi.mock("@/lib/server/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/server/auth")>()), getCaller: async () => caller }));

const { GET, POST } = await import("@/app/api/feedback/route");
const { displayStats } = await import("@/lib/app-stats");

const post = (body: Record<string, unknown>) => POST(new Request("http://local/api/feedback", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  for (const k of Object.keys(fs.store)) delete fs.store[k];
  caller = null;
  Object.assign(fs.store, {
    "chairLinks/keithtoken1": { shopId: "shop-a", chairId: "c1" },
    "shops/shop-a/private/chairs": { json: JSON.stringify([{ id: "c1", label: "Keith", barberId: "b-keith", barberName: "Keith" }]) },
  });
});

describe("Rate & send feedback (server)", () => {
  it("TC-FEEDBACK-HP-01 an owner rates once; a later rating replaces it and the summary stays one vote", async () => {
    caller = { uid: "shop-a" };
    expect((await post({ rating: 4, comment: "  Nice  " })).status).toBe(200);
    expect(fs.store["appFeedback/owner_shop-a"]).toMatchObject({ role: "owner", shopId: "shop-a", rating: 4, comment: "Nice" });
    const created = fs.store["appFeedback/owner_shop-a"]!.createdAt;
    await post({ rating: 5 });
    expect(fs.store["appFeedback/owner_shop-a"]).toMatchObject({ rating: 5, createdAt: created });
    expect(fs.store["appStats/feedback"]).toMatchObject({ count: 1, sum: 5 });
    const res = await (await GET(new Request("http://local/api/feedback"))).json();
    expect(res).toMatchObject({ summary: { count: 1, sum: 5 }, mine: { rating: 5 } });
  });

  it("TC-FEEDBACK-HP-02 a barber link rates with its token, stored under a hashed id (no raw token)", async () => {
    expect((await post({ token: "keithtoken1", rating: 3 })).status).toBe(200);
    const keys = Object.keys(fs.store).filter((k) => k.startsWith("appFeedback/"));
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^appFeedback\/barber_[0-9a-f]{32}$/);
    expect(keys[0]).not.toContain("keithtoken1");
    expect(fs.store[keys[0]!]).toMatchObject({ role: "barber", shopId: "shop-a", rating: 3 });
  });

  it("TC-FEEDBACK-NEG-01 signed-out owners, bad links and bad ratings are refused", async () => {
    expect((await post({ rating: 5 })).status).toBe(401);
    expect((await post({ token: "nope", rating: 5 })).status).toBe(404);
    caller = { uid: "shop-a" };
    expect((await post({ rating: 6 })).status).toBe(400);
    expect((await post({ rating: 2.5 })).status).toBe(400);
    expect(Object.keys(fs.store).some((k) => k.startsWith("appFeedback/"))).toBe(false);
  });

  it("TC-FEEDBACK-HP-03 stats show placeholders until 20 real ratings, then the real average and count", () => {
    expect(displayStats({ count: 19, sum: 95 })).toMatchObject({ rating: "4.8", count: "1.2k+", real: false });
    expect(displayStats({ count: 20, sum: 90 })).toMatchObject({ rating: "4.5", count: "20", countLabel: "ratings", real: true });
    expect(displayStats({ count: 1534, sum: 6900 })).toMatchObject({ count: "1.5k+" });
  });
});
