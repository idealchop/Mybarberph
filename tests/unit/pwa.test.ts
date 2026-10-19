import { describe, expect, it } from "vitest";
import { installPlatform } from "@/lib/pwa";
import { barberManifest, ownerManifest } from "@/lib/pwa-manifest";

const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1";
const IPAD_DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";

describe("Install app", () => {
  it("TC-PWA-HP-01 picks the install path per browser", () => {
    expect(installPlatform(IPHONE_SAFARI)).toBe("ios-safari");
    expect(installPlatform(IPHONE_CHROME)).toBe("ios-other");
    expect(installPlatform(IPAD_DESKTOP, 5)).toBe("ios-safari");
    expect(installPlatform(IPAD_DESKTOP, 0)).toBe("other");
    expect(installPlatform(ANDROID, 5, true)).toBe("prompt");
    expect(installPlatform(ANDROID, 5, false)).toBe("other");
  });

  it("TC-PWA-HP-02 owner manifest opens /home; barber manifest opens and stays in its own link", () => {
    const o = ownerManifest();
    expect(o).toMatchObject({ start_url: "/home", scope: "/", display: "standalone", name: "Barbers.ph" });
    expect(o.icons.some((i) => i.purpose === "maskable" && i.sizes === "512x512")).toBe(true);
    const b = barberManifest("tok_123", "Keith");
    expect(b).toMatchObject({ start_url: "/b/tok_123", scope: "/b/tok_123", id: "/b/tok_123", name: "Barbers.ph · Keith", display: "standalone" });
    expect(barberManifest("a/b", "X").start_url).toBe("/b/a%2Fb");
  });
});
