import { describe, expect, it } from "vitest";
import { bottomGap, keyboardOpen } from "@/lib/viewport-gap";
import { barOffset } from "@/lib/viewport-gap";

describe("bottom nav viewport correction", () => {
  it("no shift when layout and visual viewport agree", () => expect(bottomGap(844, 844, 0)).toBe(0));
  it("stale short layout viewport after the keyboard closes: push the bar down to the real bottom", () => expect(bottomGap(548, 844, 0)).toBe(296));
  it("accounts for visual viewport offset", () => expect(bottomGap(700, 800, 44)).toBe(144));
  it("never pulls the bar up (keyboard open)", () => expect(bottomGap(844, 500, 0)).toBe(0));
  it("detects the keyboard", () => { expect(keyboardOpen(844, 500)).toBe(true); expect(keyboardOpen(844, 800)).toBe(false); });
});

describe("barOffset (measured bar position)", () => {
  it("moves a bar stuck mid-screen down to the visible bottom", () => { expect(barOffset(640, 844, 0)).toBe(204); });
  it("leaves a correctly pinned bar alone", () => { expect(barOffset(844, 844, 0)).toBe(0); expect(barOffset(843.6, 844, 0)).toBe(0); });
  it("follows the visual viewport when it is scrolled", () => { expect(barOffset(844, 700, 100)).toBe(-44); });
});
