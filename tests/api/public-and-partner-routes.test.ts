import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const set = vi.fn(async () => undefined);
const chairLink = vi.fn(async (t: string) => (t === "live-token" ? { shopId: "shop-a", chairId: "c1" } : null));
const putState = vi.fn(async () => undefined);
vi.mock("@/lib/firebase/admin", () => ({ adminAuth: () => ({ verifyIdToken: async () => { throw new Error("no"); } }) }));
vi.mock("@/lib/server/shops", () => ({
  shopRef: () => ({ set }),
  chairLink,
  putState,
  BARBER_KEYS: new Set(["bp.chairBookings"]),
  createPublicBooking: vi.fn(async () => { throw new Error("should not be called"); }),
  publicBooking: (b: unknown) => b,
}));
const logActivity = vi.fn(async () => undefined);
vi.mock("@/lib/server/activity", () => ({ logActivity, SYSTEM: { name: "Barbers.ph", role: "system" } }));

const webhook = (await import("@/app/api/billing/webhook/route")).POST;
const book = (await import("@/app/api/public/bookings/route")).POST;
const barberState = (await import("@/app/api/barber/[token]/state/[key]/route")).PUT;
const { riverAuth } = await import("@/lib/server/river");

afterEach(() => {
  delete process.env.PAYMONGO_WEBHOOK_SECRET;
  delete process.env.RIVER_MOBILE_API_KEY;
  set.mockClear(); logActivity.mockClear(); putState.mockClear();
});

const paid = JSON.stringify({ data: { attributes: { type: "checkout_session.payment.paid", data: { attributes: { metadata: { shopId: "shop-a", plan: "pro_499" } } } } } });
const signed = (body: string, secret: string, t = "1700000000") =>
  `t=${t},te=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")},li=`;

describe("PayMongo webhook", () => {
  it("TC-BILL-NEG-01 not configured → 503, nothing written", async () => {
    const res = await webhook(new Request("http://local/api/billing/webhook", { method: "POST", body: paid }));
    expect(res.status).toBe(503);
    expect(set).not.toHaveBeenCalled();
  });
  it("TC-BILL-NEG-02 bad signature → 401, nothing written", async () => {
    process.env.PAYMONGO_WEBHOOK_SECRET = "whsec_test";
    const res = await webhook(new Request("http://local/api/billing/webhook", { method: "POST", body: paid, headers: { "paymongo-signature": signed(paid, "wrong") } }));
    expect(res.status).toBe(401);
    expect(set).not.toHaveBeenCalled();
  });
  it("TC-BILL-HP-01 valid signature activates the plan and writes an audit entry", async () => {
    process.env.PAYMONGO_WEBHOOK_SECRET = "whsec_test";
    const res = await webhook(new Request("http://local/api/billing/webhook", { method: "POST", body: paid, headers: { "paymongo-signature": signed(paid, "whsec_test") } }));
    expect(res.status).toBe(200);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ plan: "pro_499", planStatus: "active" }), { merge: true });
    expect(logActivity).toHaveBeenCalledWith("shop-a", expect.objectContaining({ type: "plan_changed" }), true);
  });
  it("TC-BILL-ODD-01 a signed event for an unknown plan changes nothing", async () => {
    process.env.PAYMONGO_WEBHOOK_SECRET = "whsec_test";
    const body = paid.replace("pro_499", "free_forever");
    const res = await webhook(new Request("http://local/api/billing/webhook", { method: "POST", body, headers: { "paymongo-signature": signed(body, "whsec_test") } }));
    expect(res.status).toBe(200);
    expect(set).not.toHaveBeenCalled();
  });
});

describe("public booking + barber link", () => {
  it("TC-BOOK-NEG-01 POST /api/public/bookings without shopId is 400", async () => {
    const res = await book(new Request("http://local/api/public/bookings", { method: "POST", body: JSON.stringify({ contact: "09171234567" }) }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "bad_request" });
  });
  it("TC-BOOK-ODD-01 a non-JSON body is 400, not a crash", async () => {
    const res = await book(new Request("http://local/api/public/bookings", { method: "POST", body: "{oops" }));
    expect(res.status).toBe(400);
  });
  it("TC-BARBER-NEG-01 an unknown, reset or turned-off barber link is 404", async () => {
    const res = await barberState(new Request("http://local", { method: "PUT", body: JSON.stringify({ value: "[]" }) }), { params: Promise.resolve({ token: "old", key: "bp.chairBookings" }) });
    expect(res.status).toBe(404);
    expect(putState).not.toHaveBeenCalled();
  });
  it("TC-BARBER-NEG-02 a barber link cannot write owner-only keys", async () => {
    const res = await barberState(new Request("http://local", { method: "PUT", body: JSON.stringify({ value: "[]" }) }), { params: Promise.resolve({ token: "live-token", key: "bp.services" }) });
    expect(res.status).toBe(400);
    expect(putState).not.toHaveBeenCalled();
  });
  it("TC-BARBER-HP-01 a live barber link writes to its own shop only", async () => {
    const res = await barberState(new Request("http://local", { method: "PUT", body: JSON.stringify({ value: "[]", shopId: "shop-b" }) }), { params: Promise.resolve({ token: "live-token", key: "bp.chairBookings" }) });
    expect(res.status).toBe(200);
    expect(putState).toHaveBeenCalledWith("shop-a", "bp.chairBookings", "[]");
  });
});

describe("River Mobile partner API key", () => {
  const req = (key?: string) => new Request("http://local/api/river/v1/shops", { headers: key ? { "x-api-key": key } : {} });
  it("TC-RIVER-NEG-01 not configured → 503", () => {
    expect(riverAuth(req("anything"))?.status).toBe(503);
  });
  it("TC-RIVER-NEG-02 missing or wrong key → 401", () => {
    process.env.RIVER_MOBILE_API_KEY = "rk_test";
    expect(riverAuth(req())?.status).toBe(401);
    expect(riverAuth(req("rk_wrong"))?.status).toBe(401);
  });
  it("TC-RIVER-HP-01 correct key (header or Bearer) passes", () => {
    process.env.RIVER_MOBILE_API_KEY = "rk_test";
    expect(riverAuth(req("rk_test"))).toBeNull();
    expect(riverAuth(new Request("http://local", { headers: { authorization: "Bearer rk_test" } }))).toBeNull();
  });
});

describe("GET /api/public/logo-proxy (SSRF guard)", () => {
  it("TC-SEC-NEG-01 rejects a host outside the allowlist without fetching it", async () => {
    const { GET } = await import("@/app/api/public/logo-proxy/route");
    const spy = vi.spyOn(globalThis, "fetch");
    const { NextRequest } = await import("next/server");
    const res = await GET(new NextRequest("http://localhost/api/public/logo-proxy?url=" + encodeURIComponent("http://169.254.169.254/latest/meta-data")));
    expect(res.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });

  it("TC-SEC-NEG-02 rejects an allowed host that redirects to a disallowed one", async () => {
    const { GET } = await import("@/app/api/public/logo-proxy/route");
    const fake = new Response("x", { status: 200, headers: { "content-type": "image/png" } });
    Object.defineProperty(fake, "url", { value: "https://evil.example.com/a.png" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(fake);
    const { NextRequest } = await import("next/server");
    const res = await GET(new NextRequest("http://localhost/api/public/logo-proxy?url=" + encodeURIComponent("https://firebasestorage.googleapis.com/v0/b/x/o/a.png")));
    expect(res.status).toBe(400);
  });

  it("TC-SEC-HP-02 proxies an image from an allowed host", async () => {
    const { GET } = await import("@/app/api/public/logo-proxy/route");
    const ok = new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "image/png" } });
    Object.defineProperty(ok, "url", { value: "https://firebasestorage.googleapis.com/v0/b/x/o/a.png" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(ok);
    const { NextRequest } = await import("next/server");
    const res = await GET(new NextRequest("http://localhost/api/public/logo-proxy?url=" + encodeURIComponent("https://firebasestorage.googleapis.com/v0/b/x/o/a.png")));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
  });
});
