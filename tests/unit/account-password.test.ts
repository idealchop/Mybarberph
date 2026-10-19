import { describe, expect, it } from "vitest";
import { authErrorMessage, newPasswordError, signInKind } from "@/lib/session";

describe("Settings › Account: sign-in method and Change password", () => {
  it("TC-ACCT-HP-01 a password account gets the form; Google-only and phone-only accounts don't", () => {
    expect(signInKind(["password"])).toBe("password");
    expect(signInKind(["google.com", "password"])).toBe("password");
    expect(signInKind(["google.com"])).toBe("google");
    expect(signInKind(["phone"])).toBe("phone");
    expect(signInKind([])).toBe("unknown");
  });
  it("TC-ACCT-NEG-01 new password checks before Firebase: length, confirm match, not the same as current", () => {
    expect(newPasswordError("short", "short", "old-pass-1")).toMatch(/at least 8/);
    expect(newPasswordError("new-pass-12", "new-pass-13", "old-pass-1")).toMatch(/don’t match/);
    expect(newPasswordError("same-pass-1", "same-pass-1", "same-pass-1")).toMatch(/haven’t used/);
    expect(newPasswordError("new-pass-12", "new-pass-12", "old-pass-1")).toBeNull();
  });
  it("TC-ACCT-NEG-02 clear messages for wrong password, weak password and requires-recent-login", () => {
    expect(authErrorMessage({ code: "auth/wrong-password" })).toBe("That’s not your current password.");
    expect(authErrorMessage({ code: "auth/invalid-credential" })).toBe("That’s not your current password.");
    expect(authErrorMessage({ code: "auth/weak-password" })).toMatch(/too weak/);
    expect(authErrorMessage({ code: "auth/requires-recent-login" })).toMatch(/log out and sign in again/);
  });
});
