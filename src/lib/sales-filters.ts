/**
 * Which Sales tabs show the location filter (Jimboy, 2026-10-21). Sales group never does: each group already
 * says which locations it covers, so a location filter there would hide part of a group's total.
 */
export type SalesView = "performance" | "services" | "barbers" | "groups";
export const showsLocationFilter = (view: SalesView | string) => view !== "groups";
