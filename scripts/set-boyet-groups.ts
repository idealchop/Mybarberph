/**
 * Sales groups for Boyet Barbershop (Jimboy, 2026-10-21): only "Group A" and "Group B", by location
 * (no individual barbers, so nothing is counted twice). Replaces the default Group 1–3.
 * - Group B: Dita Rotonda, Lakeside Phase 3 II, Windfield.
 * - Group A: every other location.
 * Writes the owner-only "barbers.sales-groups" state through putState (what the Sales group tab reads).
 * Backup of the current groups + locations goes to /workspace/backups first.
 *
 *   SEED_ACCESS_TOKEN="$(gcloud auth application-default print-access-token)" \
 *     npx vite-node --config scripts/seed.vite.config.ts scripts/set-boyet-groups.ts -- [--dry-run]
 *   Prod: add --db barbersdb --yes-this-is-prod (dry run needs no guard; it writes nothing)
 */
import { mkdirSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string, d = "") => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] ?? d : d; };
const DB = opt("db", "barbersdb-dev");
const UID = opt("uid", "boyet-barbershop-owner");
const DRY = flag("dry-run");
if (DB !== "barbersdb-dev" && DB !== "barbersdb") throw new Error(`Unknown database ${DB}`);
if (DB === "barbersdb" && !DRY && !flag("yes-this-is-prod")) throw new Error("Refusing to write PROD (barbersdb) without --yes-this-is-prod.");
process.env.FIRESTORE_DATABASE_ID = DB;
process.env.BARBERS_ENV = DB === "barbersdb" ? "prod" : "dev";

const B_NAMES = ["Dita Rotonda", "Lakeside Phase 3 II", "Windfield"];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function planGroups(branches: { id: string; name: string }[]) {
  const all = [{ id: "home", name: "Main" }, ...branches].filter((b, i, a) => a.findIndex((x) => x.id === b.id) === i);
  const inB = all.filter((b) => B_NAMES.some((n) => norm(n) === norm(b.name)));
  const missing = B_NAMES.filter((n) => !inB.some((b) => norm(b.name) === norm(n)));
  const groups = [
    { id: "ga", name: "Group A", locationIds: all.filter((b) => !inB.includes(b)).map((b) => b.id), barberIds: [] as string[] },
    { id: "gb", name: "Group B", locationIds: inB.map((b) => b.id), barberIds: [] as string[] },
  ];
  return { groups, missing, all };
}

async function main() {
  const { putState, loadState } = await import("@/lib/server/shops");
  const st = await loadState(UID, ["barbers.shop-locations", "barbers.shop-chairs", "barbers.sales-groups"]);
  const locations = JSON.parse(st["barbers.shop-locations"] || "{}") as { branches?: { id: string; name: string }[] };
  const chairs = JSON.parse(st["barbers.shop-chairs"] || "[]") as { locationId?: string; barberName?: string }[];
  const { groups, missing, all } = planGroups(locations.branches ?? []);
  console.log(`Target: ${DB} · shop ${UID}${DRY ? " · DRY RUN (no writes)" : ""}`);
  console.log(`  current groups: ${st["barbers.sales-groups"] || "(none saved: default Group 1–3)"}`);
  for (const g of groups) {
    console.log(`  ${g.name}: ${g.locationIds.length} locations`);
    for (const id of g.locationIds) console.log(`    ${id.padEnd(26)} ${String(all.find((b) => b.id === id)?.name).padEnd(22)} ${chairs.filter((c) => (c.locationId || "home") === id).map((c) => c.barberName).join(", ") || "(no barber)"}`);
  }
  if (missing.length) throw new Error(`Group B locations not found: ${missing.join(", ")}`);
  if (DRY) return;
  mkdirSync("/workspace/backups", { recursive: true });
  const file = `/workspace/backups/boyet-groups-${DB}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(file, JSON.stringify(st, null, 2));
  console.log(`  backup: ${file}`);
  await putState(UID, "barbers.sales-groups", JSON.stringify(groups));
  console.log("Done.");
}
if (!process.env.VITEST) void main().catch((e) => { console.error(e); process.exit(1); });
