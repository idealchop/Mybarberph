import { beforeEach, describe, expect, it, vi } from "vitest";

// Firebase Admin: only token verification is used by these routes. "good-token" is shop-a's owner.
const verifyIdToken = vi.fn(async (t: string) => {
  if (t === "good-token") return { uid: "shop-a", email: "owner@example.ph" };
  throw new Error("auth/argument-error");
});
vi.mock("@/lib/firebase/admin", () => ({ adminAuth: () => ({ verifyIdToken }) }));

// Firestore-backed shop service: spies only, no network.
// In-memory stand-in so a PUT can be read back through the paired GET.
const store = new Map<string, Record<string, string>>();
const putState = vi.fn(async (shopId: string, key: string, raw: string) => { store.set(shopId, { ...(store.get(shopId) ?? {}), [key]: raw }); });
const ensureShop = vi.fn(async () => ({}));
vi.mock("@/lib/server/shops", () => ({
  STATE_KEYS: { "bp.services": true },
  putState,
  ensureShop,
  loadState: vi.fn(async (shopId: string) => store.get(shopId) ?? {}),
  loadBookings: vi.fn(async () => []),
  effectivePlan: () => "partner",
  publicShop: (id: string) => ({ id }),
}));

const { GET: getShop } = await import("@/app/api/shop/route");
const { PUT: putStateRoute } = await import("@/app/api/shop/state/[key]/route");

const put = (key: string, body: unknown, token?: string) =>
  putStateRoute(
    new Request(`http://local/api/shop/state/${key}`, {
      method: "PUT",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ key }) },
  );

beforeEach(() => { putState.mockClear(); ensureShop.mockClear(); store.clear(); });

describe("owner API: mutation + paired GET", () => {
  it("TC-STATE-HP-02 a saved key is returned by GET /api/shop for the same owner only", async () => {
    const saved = JSON.stringify([{ id: "cut", name: "Haircut", price: 150 }]);
    expect((await put("bp.services", { value: saved }, "good-token")).status).toBe(200);
    const res = await getShop(new Request("http://local/api/shop", { headers: { authorization: "Bearer good-token" } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.shopId).toBe("shop-a");
    expect(body.values["bp.services"]).toBe(saved);
    expect(store.has("shop-b")).toBe(false);
  });
});

describe("owner API: auth + tenant wall", () => {
  it("TC-AUTH-NEG-01 GET /api/shop without a token is 401 unauthenticated", async () => {
    const res = await getShop(new Request("http://local/api/shop"));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: "unauthenticated" });
  });
  it("TC-AUTH-NEG-02 an invalid ID token is 401 and touches no data", async () => {
    const res = await put("bp.services", { value: "[]" }, "forged");
    expect(res.status).toBe(401);
    expect(putState).not.toHaveBeenCalled();
  });
  it("TC-SHOP-HP-01 GET /api/shop returns the caller's own shop", async () => {
    const res = await getShop(new Request("http://local/api/shop", { headers: { authorization: "Bearer good-token" } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ shopId: "shop-a" });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("PUT /api/shop/state/:key", () => {
  it("TC-STATE-HP-01 saves a known key for the signed-in owner", async () => {
    const res = await put("bp.services", { value: "[]" }, "good-token");
    expect(res.status).toBe(200);
    expect(putState).toHaveBeenCalledWith("shop-a", "bp.services", "[]");
  });
  it("TC-TENANT-NEG-01 a shopId in the body cannot redirect the write to another shop", async () => {
    await put("bp.services", { value: "[]", shopId: "shop-b" }, "good-token");
    expect(putState).toHaveBeenCalledWith("shop-a", "bp.services", "[]");
    expect(putState).not.toHaveBeenCalledWith("shop-b", expect.anything(), expect.anything());
  });
  it("TC-STATE-NEG-01 unknown key is 400 bad_request", async () => {
    const res = await put("bp.secret", { value: "[]" }, "good-token");
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "bad_request" });
    expect(putState).not.toHaveBeenCalled();
  });
  it("TC-STATE-NEG-02 value must be a JSON string", async () => {
    expect((await put("bp.services", { value: 5 }, "good-token")).status).toBe(400);
    expect((await put("bp.services", { value: "{not json" }, "good-token")).status).toBe(400);
    expect(putState).not.toHaveBeenCalled();
  });
});
