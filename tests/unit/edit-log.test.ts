import { describe, expect, it } from "vitest";
import { deleteSummary } from "@/lib/edit-log";
describe("deleteSummary", () => {
  it("names the ticket, customer, service, amount and barber", () => {
    expect(deleteSummary({ ref: "W-12", customerLabel: "Ana", serviceName: "Haircut", price: 25000, barberName: "Jun", paid: true }))
      .toBe("Owner deleted W-12 (Ana) — Haircut · ₱250 · Jun · paid");
  });
});
