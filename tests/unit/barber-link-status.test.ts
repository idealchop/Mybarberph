import { describe, expect, it } from "vitest";
import { classifyBarberLinkError, settleBarberLoad } from "@/lib/barber-link-status";
import { normalizeChairList } from "@/lib/shop-chairs";

const revoked = Object.assign(new Error("This link was replaced or turned off."), { status: 404, body: { code: "not_found", error: "This link was replaced or turned off." } });
const timeout = Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
const offline = new TypeError("Failed to fetch");
const server = Object.assign(new Error("Request failed (500)"), { status: 500, body: {} });

describe("Barber link failure is not guessed", () => {
  it("TC-LINK-NEG-03 a 404 is revoked, online or not", () => {
    expect(classifyBarberLinkError(revoked, true)).toBe("revoked");
    expect(classifyBarberLinkError(revoked, false)).toBe("revoked");
  });
  it("TC-LINK-ODD-02 a timeout or 500 on a phone with signal is unavailable, not revoked", () => {
    expect(classifyBarberLinkError(timeout, true)).toBe("unavailable");
    expect(classifyBarberLinkError(server, true)).toBe("unavailable");
  });
  it("TC-LINK-ODD-03 a transport failure while the phone is offline is offline, not revoked", () => {
    expect(classifyBarberLinkError(offline, false)).toBe("offline");
  });
  it("TC-LINK-HP-06 revocation drops any saved copy; a transient failure keeps it", () => {
    expect(settleBarberLoad(revoked, { online: true, hasCache: true, hasShop: true })).toEqual({ failure: "revoked", action: "revoke" });
    expect(settleBarberLoad(server, { online: true, hasCache: false, hasShop: true })).toEqual({ failure: "unavailable", action: "keep" });
    expect(settleBarberLoad(timeout, { online: true, hasCache: true, hasShop: false })).toEqual({ failure: "unavailable", action: "cache" });
    expect(settleBarberLoad(offline, { online: false, hasCache: false, hasShop: false })).toEqual({ failure: "offline", action: "error" });
  });
});

describe("Chair rows that carry a link are not dropped", () => {
  it("TC-LINK-HP-04 a link with no seat label is kept, and a legacy expiry becomes the review date", () => {
    const list = normalizeChairList(JSON.stringify([
      { id: "c1", linkToken: "abcdefgh1234", barberName: "A" },
      { id: "c2" },
      { nope: true },
      { id: "c3", label: "B", barberId: "b3", linkToken: "token12345678", linkExpiresAt: 1 },
    ]));
    expect(list.map((c) => c.id).sort()).toEqual(["c1", "c2", "c3"]);
    expect(list.find((c) => c.id === "c1")).toMatchObject({ linkToken: "abcdefgh1234", barberName: "A" });
    const migrated = list.find((c) => c.id === "c3");
    expect(migrated?.linkReviewAt).toBe(1);
    expect(migrated).not.toHaveProperty("linkExpiresAt");
  });
  it("TC-LINK-NEG-04 a bad payload does not wipe the list the caller already has to merge", () => {
    expect(normalizeChairList("not json")).toEqual([]);
    expect(normalizeChairList({ id: "c1" })).toEqual([]);
  });
});
