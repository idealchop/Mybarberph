import { describe, expect, it } from "vitest";
import { isOwnerCut, ownerCut, OWNER_BARBER_ID } from "@/lib/owner-cut";

const r = (o: Partial<{ id: string; status: string; barberId: string; startedAt: number; createdAt: number }>) => ({ id: "x", status: "in_chair", createdAt: 1, ...o });

describe("owner's own cut", () => {
  it("finds the owner's in-progress walk-in only", () => {
    expect(ownerCut([r({ barberId: "b1" }), r({ status: "done", barberId: OWNER_BARBER_ID })])).toBeNull();
    expect(ownerCut([r({ id: "a", barberId: OWNER_BARBER_ID, startedAt: 5 }), r({ id: "b", barberId: OWNER_BARBER_ID, startedAt: 9 }), r({ id: "c", barberId: "b1", startedAt: 20 })])?.id).toBe("b");
  });
  it("works with no barbers at all", () => expect(ownerCut([r({ barberId: OWNER_BARBER_ID })])?.barberId).toBe("owner"));
  it("isOwnerCut", () => { expect(isOwnerCut({ barberId: "owner" })).toBe(true); expect(isOwnerCut({})).toBe(false); });
});
