import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { statusLabel } from "@/lib/chair-bookings";

const read = (p: string) => readFileSync(p, "utf8");

describe("v1.0.35 no 'chair' wording in the app UI", () => {
  it("request status says Haircut started", () => {
    expect(statusLabel("in_chair")).toBe("Haircut started");
  });
  it.each([
    ["src/features/queue/queue-board.tsx", ["in the chair", "In the chair"]],
    ["src/components/qr/request-status.tsx", ["\"In chair\""]],
    ["src/features/settings/seat-list.tsx", ["Vacant since", "In use since", "name=\"chair\""]],
    ["src/features/sales/sales-record.tsx", ["\"Chair\"", "All chairs"]],
    ["src/components/common/locked-feature.tsx", ["chairs setup"]],
    ["src/features/queue/seats-screen.tsx", ["No chairs yet"]],
    ["src/features/scan/find-ticket.tsx", ["Every chair"]],
    ["src/features/home/home-screen.tsx", ["pin, chairs"]],
    ["src/features/settings/manage-shop-screen.tsx", ["Its chairs"]],
  ])("%s has no chair text", (file, banned) => {
    const src = read(file);
    for (const b of banned) expect(src).not.toContain(b);
  });
});
