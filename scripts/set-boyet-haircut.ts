/**
 * Boyet Barbershop haircut price (Jimboy, 2026-10-21): Haircut ₱115 for the shop and every location.
 * - Sets the default Haircut price in the menu state (putState mirrors it to the public shop doc).
 * - Clears any per-location Haircut price (locations' priceOverrides, and old ignored menu overrides).
 * Existing sales keep their stored prices. Backup of menu + locations goes to /workspace/backups first.
 *
 *   SEED_ACCESS_TOKEN="$(gcloud auth application-default print-access-token)" \
 *     npx vite-node --config scripts/seed.vite.config.ts scripts/set-boyet-haircut.ts -- [--dry-run] [--price 115]
 *   Prod: add --db barbersdb --yes-this-is-prod (dry run needs no guard; it writes nothing)
 */
import { mkdirSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string, d = "") => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] ?? d : d; };
const DB = opt("db", "barbersdb-dev");
const UID = opt("uid", "boyet-barbershop-owner");
const PRICE = Number(opt("price", "115"));
const DRY = flag("dry-run");
if (DB !== "barbersdb-dev" && DB !== "barbersdb") throw new Error(`Unknown database ${DB}`);
if (!(PRICE > 0 && PRICE <= 100_000)) throw new Error("--price must be 1–100000 pesos");
if (DB === "barbersdb" && !DRY && !flag("yes-this-is-prod")) throw new Error("Refusing to write PROD (barbersdb) without --yes-this-is-prod.");
process.env.FIRESTORE_DATABASE_ID = DB;
process.env.BARBERS_ENV = DB === "barbersdb" ? "prod" : "dev";

type Menu = { haircut?: { price?: number; [k: string]: unknown }; overrides?: Record<string, { haircut?: Record<string, unknown>; [k: string]: unknown }>; [k: string]: unknown };
type Branch = { id: string; name: string; priceOverrides?: Record<string, number>; [k: string]: unknown };

async function main() {
  const { putState, loadState, getPublicShop } = await import("@/lib/server/shops");
  const st = await loadState(UID, ["barbers.shop-menu", "barbers.shop-locations"]);
  const menu = JSON.parse(st["barbers.shop-menu"] || "{}") as Menu;
  const locs = JSON.parse(st["barbers.shop-locations"] || "{}") as { branches?: Branch[]; [k: string]: unknown };
  const branches = locs.branches ?? [];
  const withOwn = branches.filter((b) => b.priceOverrides && "haircut" in b.priceOverrides);
  const legacy = Object.keys(menu.overrides ?? {}).filter((k) => menu.overrides?.[k]?.haircut && "price" in (menu.overrides[k]!.haircut as object));
  console.log(`Target: ${DB} · shop ${UID}${DRY ? " · DRY RUN (no writes)" : ""}`);
  console.log(`  default Haircut now ₱${menu.haircut?.price ?? 0} -> ₱${PRICE}`);
  console.log(`  locations: ${branches.length} · with own Haircut price: ${withOwn.length}${withOwn.length ? ` (${withOwn.map((b) => `${b.name} ₱${b.priceOverrides!.haircut}`).join(", ")})` : ""} · old menu overrides: ${legacy.length}`);
  if (DRY) return;
  mkdirSync("/workspace/backups", { recursive: true });
  const file = `/workspace/backups/boyet-haircut-${DB}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(file, JSON.stringify(st, null, 2));
  console.log(`  backup: ${file}`);
  const nextMenu: Menu = { ...menu, haircut: { ...(menu.haircut ?? { name: "Haircut" }), price: PRICE } };
  if (menu.overrides) nextMenu.overrides = Object.fromEntries(Object.entries(menu.overrides).map(([k, o]) => { const h = { ...(o.haircut ?? {}) }; delete h.price; return [k, { ...o, haircut: Object.keys(h).length ? h : undefined }]; }));
  const nextBranches = branches.map((b) => { if (!b.priceOverrides) return b; const p = { ...b.priceOverrides }; delete p.haircut; return { ...b, priceOverrides: p }; });
  await putState(UID, "barbers.shop-menu", JSON.stringify(nextMenu));
  if (withOwn.length) await putState(UID, "barbers.shop-locations", JSON.stringify({ ...locs, branches: nextBranches }));
  const shop = await getPublicShop(UID);
  const def = shop?.services.find((s) => s.id === "haircut")?.price;
  const bad = (shop?.branches ?? []).filter((b) => (shop!.servicesByLocation[b.id] || shop!.services).find((s) => s.id === "haircut")?.price !== PRICE * 100);
  console.log(`  read back: default ₱${(def ?? 0) / 100} · locations at ₱${PRICE}: ${(shop?.branches.length ?? 0) - bad.length}/${shop?.branches.length ?? 0}${bad.length ? ` · NOT: ${bad.map((b) => b.name).join(", ")}` : ""}`);
}
if (!process.env.VITEST) void main().catch((e) => { console.error(e); process.exit(1); });
