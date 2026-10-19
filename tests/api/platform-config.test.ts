import { afterEach, describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import robots from "@/app/robots";

afterEach(() => { delete process.env.BARBERS_ENV; });

describe("platform config", () => {
  it("TC-SEC-NF-01 every response carries the baseline security headers", async () => {
    const rules = await nextConfig.headers!();
    const all = rules.find((r) => r.source === "/:path*")!;
    const h = Object.fromEntries(all.headers.map((x) => [x.key.toLowerCase(), x.value]));
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("SAMEORIGIN");
    expect(h["strict-transport-security"]).toMatch(/max-age=\d+/);
    expect(h["permissions-policy"]).toContain("microphone=()");
    expect(nextConfig.poweredByHeader).toBe(false);
  });
  it("TC-SEO-NF-01 robots: dev blocks everything", () => {
    process.env.BARBERS_ENV = "dev";
    expect(robots().rules).toEqual([{ userAgent: "*", disallow: "/" }]);
  });
  it("TC-SEO-NF-02 robots: prod blocks only the API", () => {
    process.env.BARBERS_ENV = "prod";
    expect(robots().rules).toEqual([{ userAgent: "*", allow: "/", disallow: ["/api/"] }]);
  });
});
