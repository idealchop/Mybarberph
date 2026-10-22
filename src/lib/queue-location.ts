/** Rows for the Queue's location picker: one location (no locationId = main/home), or every location. */
export function rowsForLocation<T extends { locationId?: string }>(rows: T[], locationId: string, all: boolean, home = "home"): T[] {
  return all ? rows : rows.filter((r) => (r.locationId || home) === locationId);
}
