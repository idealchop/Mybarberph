import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const weeklyTips = vi.fn(async () => ({ ok: true }));
vi.mock("@/lib/server/companion/companion", () => ({ weeklyTips, allShopIds: vi.fn(async () => []) }));

const call = async (headers: Record<string, string>) => {
  const { POST } = await import("@/app/api/companion/tips/route");
  return POST(new Request("http://localhost/api/companion/tips", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ shopId: "shop-a" }) }));
};

describe("POST /api/companion/tips (cron secret)", () => {
  beforeEach(() => { vi.stubEnv("COMPANION_ENABLED", "1"); vi.stubEnv("COMPANION_CRON_SECRET", "s3cret-value"); });
  afterEach(() => { vi.unstubAllEnvs(); weeklyTips.mockClear(); });

  it("TC-CRON-NEG-01 a wrong or missing secret is 401 and runs nothing", async () => {
    expect((await call({ authorization: "Bearer nope" })).status).toBe(401);
    expect((await call({})).status).toBe(401);
    expect(weeklyTips).not.toHaveBeenCalled();
  });

  it("TC-CRON-HP-01 the right secret (Bearer or x-companion-cron) runs the tips", async () => {
    expect((await call({ authorization: "Bearer s3cret-value" })).status).toBe(200);
    expect((await call({ "x-companion-cron": "s3cret-value" })).status).toBe(200);
    expect(weeklyTips).toHaveBeenCalledTimes(2);
  });
});
