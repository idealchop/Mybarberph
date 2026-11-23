import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeFirestore } from "../stubs/fake-firestore";

// River Partner API v1 end to end on a fake barbersdb-dev: 2FA (dev-key factor 1 + HMAC), scopes,
// Idempotency-Key, create (source river_mobile), get, cancel, check-in, and the "cancelled never moves forward" rule.
const fs = fakeFirestore();
vi.mock("@/lib/firebase/admin", () => ({ adminDb: () => fs, adminAuth: () => ({}) }));
vi.mock("@/lib/server/activity", () => ({ bookingActivity: vi.fn(async () => undefined), stateActivity: vi.fn(async () => undefined), logActivity: vi.fn(async () => undefined), OWNER: { name: "Owner", role: "owner" } }));
vi.mock("@/lib/server/notify", () => ({ notifyNewOnlineBooking: vi.fn(async () => undefined) }));

const SECRET = "test-request-secret-v1-0123456789abcdef"; // test-only value
const DEV_KEY = "local-dev-key-123456";
const ORIGIN = "https://barbers-ph-dev--mybarberph.asia-southeast1.hosted.app";
const SHOP = "shop-uid-0001";
const saved = { ...process.env };

beforeAll(() => {
  Object.assign(process.env, { BARBERS_ENV: "dev", FIRESTORE_DATABASE_ID: "barbersdb-dev", RIVER_BRIDGE_REQUEST_SECRET_V1: SECRET, RIVER_DEV_API_KEY: DEV_KEY, RIVER_WEBHOOKS_ENABLED: "0" });
  fs.store[`shops/${SHOP}`] = { name: "River Barbershop", listed: true, menu: [{ id: "haircut", name: "Haircut", durationMins: 30, price: 25000, kind: "haircut" }], branches: [] };
});
beforeEach(() => { vi.spyOn(console, "info").mockImplementation(() => undefined); });
afterAll(() => { process.env = saved; });

const { signRequest } = await import("@/lib/server/river-bridge/sign");
const createRoute = (await import("@/app/api/river/v1/shops/[shopId]/bookings/route")).POST;
const getRoute = (await import("@/app/api/river/v1/shops/[shopId]/bookings/[id]/route")).GET;
const cancelRoute = (await import("@/app/api/river/v1/orders/[id]/cancel/route")).POST;
const checkInRoute = (await import("@/app/api/river/v1/orders/[id]/check-in/route")).POST;
const verifyRoute = (await import("@/app/api/river/v1/shops/[shopId]/verify/route")).POST;
const healthRoute = (await import("@/app/api/river/v1/health/route")).GET;
const { putBooking } = await import("@/lib/server/shops");

function req(method: string, path: string, body?: unknown, idem?: string, auth = DEV_KEY) {
  const raw = body === undefined ? "" : JSON.stringify(body);
  const s = signRequest({ method, pathWithQuery: path, body: raw, keyId: "bridge-to-barbers-dev-v1", secret: SECRET, authorization: `Bearer ${auth}`, idempotencyKey: idem, nonce: randomUUID() });
  return new Request(`${ORIGIN}${path}`, { method, headers: s.headers, body: method === "GET" ? undefined : raw });
}
const p = <T,>(v: T) => ({ params: Promise.resolve(v) });
const key = () => `idem-${randomUUID()}`;

async function create() {
  const res = await createRoute(req("POST", `/api/river/v1/shops/${SHOP}/bookings`, { customerName: "Ana", serviceIds: ["haircut"], customer: { ref: "cref-1", name: "Ana", phoneE164: "+639171234567" } }, key()), p({ shopId: SHOP }));
  expect(res.status).toBe(201);
  return (await res.json()) as { booking: { id: string; ref: string; status: string }; order: { orderId: string; status: string } };
}

describe("River Partner API v1 (dev)", () => {
  it("TC-RB-API-01 health is open and says only liveness + apiVersion", async () => {
    expect(await healthRoute().json()).toEqual({ status: "ok", apiVersion: "v1" });
  });

  it("TC-RB-API-02 the old shared key alone (no signature) is 401", async () => {
    const res = await getRoute(new Request(`${ORIGIN}/api/river/v1/shops/${SHOP}/bookings/x`, { headers: { "x-api-key": "rk_old", authorization: "Bearer rk_old" } }), p({ shopId: SHOP, id: "xyz" }));
    expect(res.status).toBe(401);
  });

  it("TC-RB-API-03 create lands as source river_mobile in Queue → Online (requested), indexed for order lookups", async () => {
    const { booking, order } = await create();
    expect(order).toMatchObject({ orderId: booking.id, status: "requested" });
    const row = fs.store[`shops/${SHOP}/bookings/${booking.id}`] as Record<string, unknown>;
    expect(row).toMatchObject({ source: "river_mobile", channel: "online", status: "requested", customerRef: "cref-1" });
    expect(fs.store[`riverOrders/${booking.id}`]).toMatchObject({ shopId: SHOP });
    const got = await getRoute(req("GET", `/api/river/v1/shops/${SHOP}/bookings/${booking.id}`), p({ shopId: SHOP, id: booking.id }));
    expect((await got.json()).order.status).toBe("requested");
  });

  it("TC-RB-API-04 writes without Idempotency-Key are 400", async () => {
    const res = await createRoute(req("POST", `/api/river/v1/shops/${SHOP}/bookings`, { customerName: "Ana" }), p({ shopId: SHOP }));
    expect(res.status).toBe(400);
  });

  it("TC-RB-API-05 cancel while requested → cancelled; replay returns the same; a later owner write can't move it forward", async () => {
    const { booking } = await create();
    const k = key();
    const path = `/api/river/v1/orders/${booking.id}/cancel`;
    const first = await cancelRoute(req("POST", path, { reason: "changed plans" }, k), p({ id: booking.id }));
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ orderId: booking.id, status: "cancelled" });
    const replay = await cancelRoute(req("POST", path, { reason: "changed plans" }, k), p({ id: booking.id }));
    expect(replay.headers.get("idempotent-replayed")).toBe("true");
    const again = await cancelRoute(req("POST", path, {}, key()), p({ id: booking.id }));
    expect(again.status).toBe(200);
    const cur = fs.store[`shops/${SHOP}/bookings/${booking.id}`] as Record<string, unknown>;
    await putBooking(SHOP, { ...(cur as object), status: "accepted" });
    await putBooking(SHOP, { ...(cur as object), status: "in_chair" });
    expect((fs.store[`shops/${SHOP}/bookings/${booking.id}`] as { status: string }).status).toBe("cancelled");
    const checkIn = await checkInRoute(req("POST", `/api/river/v1/orders/${booking.id}/check-in`, { code: booking.ref }, key()), p({ id: booking.id }));
    expect(checkIn.status).toBe(409);
    const verify = await verifyRoute(req("POST", `/api/river/v1/shops/${SHOP}/verify`, { code: booking.ref }, key()), p({ shopId: SHOP }));
    expect(verify.status).toBe(409);
  });

  it("TC-RB-API-06 cancel after the cut started is 409; an unknown order is 404", async () => {
    const { booking } = await create();
    const cur = fs.store[`shops/${SHOP}/bookings/${booking.id}`] as object;
    await putBooking(SHOP, { ...cur, status: "in_chair" });
    const res = await cancelRoute(req("POST", `/api/river/v1/orders/${booking.id}/cancel`, {}, key()), p({ id: booking.id }));
    expect(res.status).toBe(409);
    const none = await cancelRoute(req("POST", `/api/river/v1/orders/nope-123/cancel`, {}, key()), p({ id: "nope-123" }));
    expect(none.status).toBe(404);
  });

  it("TC-RB-API-07 an app write can't set cancelled", async () => {
    const { booking } = await create();
    const cur = fs.store[`shops/${SHOP}/bookings/${booking.id}`] as object;
    await expect(putBooking(SHOP, { ...cur, status: "cancelled" })).rejects.toThrow();
    expect((fs.store[`shops/${SHOP}/bookings/${booking.id}`] as { status: string }).status).toBe("requested");
  });

  it("TC-RB-API-08 check-in by order id accepts the ticket (same as verify); legacy source river tickets still work with a shopId hint", async () => {
    const { booking } = await create();
    const res = await checkInRoute(req("POST", `/api/river/v1/orders/${booking.id}/check-in`, { code: booking.ref }, key()), p({ id: booking.id }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "accepted" });
    fs.store[`shops/${SHOP}/bookings/river-legacy01`] = { id: "river-legacy01", shopId: SHOP, ref: "BK-LEGACY", channel: "online", status: "requested", source: "river", contact: "", customerLabel: "Ben", serviceId: "haircut", serviceName: "Haircut", price: 25000, slotLabel: "Now", payWhere: "shop", createdAt: 1, updatedAt: 1 };
    const got = await getRoute(req("GET", `/api/river/v1/shops/${SHOP}/bookings/river-legacy01`), p({ shopId: SHOP, id: "river-legacy01" }));
    expect(got.status).toBe(200);
    const c = await cancelRoute(req("POST", `/api/river/v1/orders/river-legacy01/cancel`, { shopId: SHOP }, key()), p({ id: "river-legacy01" }));
    expect(c.status).toBe(200);
    expect((await c.json()).status).toBe("cancelled");
  });

  it("TC-RB-API-09 nonces and idempotency records are stored server-side with a TTL field", () => {
    const nonceDocs = Object.entries(fs.store).filter(([k]) => k.startsWith("riverNonces/"));
    const idemDocs = Object.entries(fs.store).filter(([k]) => k.startsWith("riverIdempotency/"));
    expect(nonceDocs.length).toBeGreaterThan(5);
    expect(idemDocs.length).toBeGreaterThan(3);
    for (const [, d] of [...nonceDocs, ...idemDocs]) expect((d as { expireAt?: unknown }).expireAt).toBeDefined();
    expect(JSON.stringify(nonceDocs)).not.toContain(SECRET);
  });
});
