import { describe, expect, it } from "vitest";
import { parseContact } from "@/lib/chair-bookings";
import { boldOnly, PRIVACY, TERMS } from "@/lib/legal";

describe("parseContact (customer booking contact)", () => {
  it("TC-BOOK-HP-01 accepts a Philippine mobile in common formats", () => {
    expect(parseContact("+63 917 123 4567")).toBe("09171234567");
    expect(parseContact("0917-123-4567")).toBe("09171234567");
  });
  it("TC-BOOK-HP-02 accepts and lower-cases an email", () => {
    expect(parseContact(" Juan@Example.PH ")).toBe("juan@example.ph");
  });
  it("TC-BOOK-NEG-02 rejects empty, malformed and non-mobile values", () => {
    expect(parseContact("")).toBeNull();
    expect(parseContact("juan@")).toBeNull();
    expect(parseContact("02 8123 4567")).toBeNull();
    expect(parseContact(`${"a".repeat(120)}@x.ph`)).toBeNull();
  });
});

describe("boldOnly (legal page HTML sink)", () => {
  it("TC-LEGAL-NF-02 security: escapes markup other than <b>", () => {
    expect(boldOnly('<b>ok</b> <script>alert(1)</script> <img src=x onerror=alert(1)>')).toBe(
      "<b>ok</b> &lt;script&gt;alert(1)&lt;/script&gt; &lt;img src=x onerror=alert(1)&gt;",
    );
  });
  it("TC-LEGAL-HP-01 today's legal copy renders unchanged", () => {
    for (const doc of [TERMS, PRIVACY])
      for (const s of doc.sections)
        for (const b of s.blocks) for (const text of typeof b === "string" ? [b] : b.list)
          expect(boldOnly(text)).toBe(text.replace(/&/g, "&amp;"));
  });
});
