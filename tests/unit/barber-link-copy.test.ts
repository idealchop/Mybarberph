import { afterEach, describe, expect, it, vi } from "vitest";
import { barberLinkUrl, isUrlOnly, writeBarberLinkUrl } from "@/lib/barber-link-copy";
import { readLocalOwnerFixtureFrom } from "@/lib/local-owner-fixture";
import { readFileSync } from "node:fs";

const URL = "https://barbersph.web.app/b/example-only";

afterEach(() => { vi.unstubAllGlobals(); });

describe("Barber link clipboard text", () => {
  it("TC-COPY-HP-01 the clipboard value is the absolute URL and nothing else", () => {
    expect(barberLinkUrl("https://barbersph.web.app", "/b/example-only")).toBe(URL);
    expect(barberLinkUrl("https://barbersph.web.app/", "/b/example-only")).toBe(URL);
    expect(isUrlOnly(URL)).toBe(true);
    expect(URL).not.toMatch(/Jusfter|Your barber link|\s/);
  });
  it("TC-COPY-NEG-01 a value with a name, a space, or a newline is not url-only", () => {
    expect(isUrlOnly(`Your barber link, Jusfter ${URL}`)).toBe(false);
    expect(isUrlOnly(`${URL}\n`)).toBe(false);
    expect(isUrlOnly(` ${URL}`)).toBe(false);
  });
  it("TC-COPY-HP-02 writeText is called with that URL only, and share is never used", async () => {
    const writes: string[] = [];
    let shared = 0;
    vi.stubGlobal("navigator", {
      clipboard: { writeText: (text: string) => { writes.push(text); return Promise.resolve(); } },
      share: () => { shared += 1; return Promise.resolve(); },
    });
    expect(await writeBarberLinkUrl(URL)).toBe(true);
    expect(writes).toEqual([URL]);
    expect(shared).toBe(0);
  });
  it("TC-COPY-NEG-02 a denied or missing clipboard is a failed copy", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: () => Promise.reject(new Error("denied")) } });
    expect(await writeBarberLinkUrl(URL)).toBe(false);
    vi.stubGlobal("navigator", {});
    expect(await writeBarberLinkUrl(URL)).toBe(false);
  });
  it("TC-COPY-NEG-03 Share to Barber does not call navigator.share", () => {
    const src = readFileSync("src/features/settings/services-screen.tsx", "utf8");
    expect(src).not.toContain("navigator.share");
    expect(src).toContain("writeBarberLinkUrl");
  });
});

describe("Local owner fixture", () => {
  const raw = JSON.stringify({ shopId: "fixture-shop", values: { a: "1" } });
  const read = (k: string) => (k === "bp.ownerFixture" ? raw : null);
  it("TC-COPY-NEG-04 a production host never reads the fixture", () => {
    expect(readLocalOwnerFixtureFrom("barbersph.web.app", read)).toBeNull();
  });
  it("TC-COPY-HP-03 localhost can read a session fixture", () => {
    expect(readLocalOwnerFixtureFrom("127.0.0.1", read)?.shopId).toBe("fixture-shop");
  });
});
