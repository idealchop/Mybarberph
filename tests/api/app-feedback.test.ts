import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fakeFirestore } from "../stubs/fake-firestore";

const fs = fakeFirestore();
vi.mock("@/lib/firebase/admin", () => ({ adminDb: () => fs, adminAuth: () => ({}) }));
let caller: { uid: string } | null = null;
vi.mock("@/lib/server/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/server/auth")>()), getCaller: async () => caller }));

const { GET, POST } = await import("@/app/api/feedback/route");

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
    // GET returns only the caller's review (≤1 doc); no summary for the Install UI.
    expect(res).toMatchObject({ mine: { rating: 5 } });
    expect(res.summary).toBeUndefined();
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

  it("TC-FEEDBACK-HP-03 GET without a caller returns mine:null and does not require a summary", async () => {
    const res = await (await GET(new Request("http://local/api/feedback"))).json();
    expect(res).toEqual({ mine: null });
  });
});

describe("Install page v2 (Shops PH standard)", () => {
  const panel = readFileSync(new URL("../../src/components/pwa/install-panel.tsx", import.meta.url), "utf8");
  const settings = readFileSync(new URL("../../src/features/settings/settings-screen.tsx", import.meta.url), "utf8");
  const barber = readFileSync(new URL("../../src/features/barber/barber-link-screen.tsx", import.meta.url), "utf8");

  it("has no stats row, average, count, or review list on the Install panel", () => {
    expect(panel).not.toContain("displayStats");
    expect(panel).not.toContain("App stats");
    expect(panel).not.toContain("APP_STATS");
    expect(panel).not.toContain("Average rating");
    expect(panel).not.toMatch(/1\.2k\+/);
    expect(panel).toContain("Open app");
    expect(panel).toContain("Rate & send feedback");
    expect(panel).toMatch(/underline/);
    expect(panel).toContain("Post");
    expect(panel).toMatch(/text-\[16px\]/);
    expect(panel).not.toMatch(/autoFocus|autofocus/);
  });

  it("keeps Install app linked from Settings and barber My sales even when installed", () => {
    expect(settings).not.toContain("useInstallHidden");
    expect(settings).toContain('href: "/settings/install"');
    expect(barber).not.toContain("useInstallHidden");
    expect(barber).toContain("setInstall(true)");
    expect(barber).not.toMatch(/installHidden \? null/);
  });
});
