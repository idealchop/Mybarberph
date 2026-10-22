import { describe, expect, it } from "vitest";
import { addableServices } from "@/lib/addable-services";
describe("addableServices", () => {
  it("excludes selected services", () => {
    expect(addableServices([{ id: "a" }, { id: "b" }, { id: "c" }], ["a", "c"]).map((x) => x.id)).toEqual(["b"]);
  });
});
