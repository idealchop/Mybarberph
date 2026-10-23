import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { BARBER_3D_ICONS, riverIconSrc } from "@/components/common/river-icon";
import { BARBER_ICON_ART } from "@/components/art/barber-icons";

describe("Barbers.ph 3D icons", () => {
  it("picks the 128 file for small sizes and 256 for large", () => {
    expect(riverIconSrc("home", 32)).toBe("/icons3d/barbers/128/home.webp");
    expect(riverIconSrc("orders", 96)).toBe("/icons3d/barbers/256/orders.webp");
  });
  it("every concept has both files in public/ and a manifest entry", () => {
    const man = JSON.parse(readFileSync("public/icons3d/barbers/manifest.json", "utf8")) as { icons: { concept: string }[] };
    const listed = new Set(man.icons.map((i) => i.concept));
    for (const n of BARBER_3D_ICONS) {
      expect(listed.has(n), n).toBe(true);
      for (const s of [128, 256]) expect(existsSync(`public/icons3d/barbers/${s}/${n}.webp`), `${s}/${n}`).toBe(true);
    }
  });
  it("every stored service icon key maps to a 3D icon", () => {
    for (const v of Object.values(BARBER_ICON_ART)) expect(BARBER_3D_ICONS).toContain(v);
  });
  it("the generic River pack is gone from public/", () => {
    expect(existsSync("public/icons3d/river")).toBe(false);
  });
});
