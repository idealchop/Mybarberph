import { describe, expect, it } from "vitest";
import { parseTicketCode } from "@/lib/ticket-code";

describe("parseTicketCode (scan to verify)", () => {
  it("TC-SCAN-HP-01 reads the code from a ticket URL", () => {
    expect(parseTicketCode("https://barbersph.web.app/book/status?code=bk-ab12cd")).toBe("BK-AB12CD");
  });
  it("TC-SCAN-HP-02 reads a bare code inside other text", () => {
    expect(parseTicketCode("Ticket BK-7KQ2MZ for Juan")).toBe("BK-7KQ2MZ");
  });
  it("TC-SCAN-ODD-01 accepts older two-letter refs", () => {
    expect(parseTicketCode("rm-48213")).toBe("RM-48213");
  });
  it("TC-SCAN-NEG-01 returns the trimmed, upper-cased input when nothing matches", () => {
    expect(parseTicketCode("  hello  ")).toBe("HELLO");
  });
});
