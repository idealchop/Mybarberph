import { describe, expect, it } from "vitest";
import { isOnlineChoice, payChoices } from "@/components/qr/pay-choices";

describe("booking pay options", () => {
  it("offers Cash and Online", () => {
    expect(payChoices()).toEqual(["cash", "online"]);
  });
  it("treats older GCash/Maya choices as Online", () => {
    expect(["online", "gcash", "maya"].every(isOnlineChoice)).toBe(true);
    expect(isOnlineChoice("cash")).toBe(false);
    expect(isOnlineChoice(undefined)).toBe(false);
  });
});
