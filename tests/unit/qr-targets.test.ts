import { describe, expect, it } from "vitest";
import { qrTargets } from "@/lib/qr-targets";

const branches = [{ id: "home", name: "San Antonio" }, { id: "loc-demo-pacita", name: "Pacita (Demo)" }, { id: "loc-demo-landayan", name: "Landayan (Demo)" }];
describe("QR codes page: one QR per location", () => {
  it("each card's link books that location; the active one comes first; files are named after the location", () => {
    const t = qrTargets({ origin: "https://x.app", shopId: "s 1", shopName: "Bossing", enabled: true, branches, activeId: "loc-demo-pacita" });
    expect(t.map((x) => x.id)).toEqual(["loc-demo-pacita", "home", "loc-demo-landayan"]);
    expect(t[0]).toMatchObject({ active: true, name: "Pacita (Demo)", url: "https://x.app/book?shop=s%201&loc=loc-demo-pacita", file: "Bossing-Pacita-Demo-QR.png" });
    for (const x of t) expect(new URL(x.url).searchParams.get("loc")).toBe(x.id);
    expect(t.filter((x) => x.active)).toHaveLength(1);
  });
  it("All locations: every location, none forced active", () => {
    const t = qrTargets({ origin: "https://x.app", shopId: "s", shopName: "Bossing", enabled: true, branches, activeId: null });
    expect(t).toHaveLength(3); expect(t.some((x) => x.active)).toBe(false);
  });
  it("single shop: one QR with no location parameter", () => {
    const t = qrTargets({ origin: "https://x.app", shopId: "s", shopName: "Boyet", enabled: false, branches: [], activeId: "home" });
    expect(t).toEqual([{ id: undefined, name: "Boyet", url: "https://x.app/book?shop=s", active: true, file: "Boyet-QR.png" }]);
  });
  it("nothing until the origin and shop are known", () => expect(qrTargets({ origin: "", shopId: "s", shopName: "B", enabled: false, branches: [] })).toEqual([]));
});
