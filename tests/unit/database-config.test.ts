import { describe, expect, it } from "vitest";
import { resolveDatabaseId } from "@/lib/firebase/admin";

describe("Firestore database selection (no silent PROD fallback)", () => {
  it("TC-ENV-HP-01 DEV uses barbersdb-dev and PROD uses barbersdb, exactly as configured", () => {
    expect(resolveDatabaseId({ BARBERS_ENV: "dev", FIRESTORE_DATABASE_ID: "barbersdb-dev" })).toBe("barbersdb-dev");
    expect(resolveDatabaseId({ BARBERS_ENV: "prod", FIRESTORE_DATABASE_ID: "barbersdb" })).toBe("barbersdb");
  });
  it("TC-ENV-NEG-01 no database set fails clearly instead of defaulting to PROD", () => {
    expect(() => resolveDatabaseId({})).toThrow(/FIRESTORE_DATABASE_ID is not set/);
    expect(() => resolveDatabaseId({ BARBERS_ENV: "prod" })).toThrow(/not set/);
  });
  it("TC-ENV-NEG-02 an unknown database id is refused", () => {
    expect(() => resolveDatabaseId({ FIRESTORE_DATABASE_ID: "(default)" })).toThrow(/not a Barbers.ph database/);
  });
  it("TC-ENV-NEG-03 DEV pointed at the PROD database (or the reverse) is refused", () => {
    expect(() => resolveDatabaseId({ BARBERS_ENV: "dev", FIRESTORE_DATABASE_ID: "barbersdb" })).toThrow(/BARBERS_ENV=dev must use barbersdb-dev/);
    expect(() => resolveDatabaseId({ BARBERS_ENV: "prod", FIRESTORE_DATABASE_ID: "barbersdb-dev" })).toThrow(/BARBERS_ENV=prod must use barbersdb/);
  });
  it("TC-ENV-ODD-01 local runs without BARBERS_ENV may use either database, but must name one", () => {
    expect(resolveDatabaseId({ NEXT_PUBLIC_FIRESTORE_DATABASE_ID: "barbersdb-dev" })).toBe("barbersdb-dev");
  });
});
