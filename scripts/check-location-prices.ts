/**
 * DEV-only check (barbersdb-dev, refuses anything else): set a price for selected locations the way the
 * Edit service Save does, then prove every other location and the default price are byte-identical, then restore.
 *   SEED_ACCESS_TOKEN=... npx vite-node --config scripts/seed.vite.config.ts scripts/check-location-prices.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
process.env.FIRESTORE_DATABASE_ID = "barbersdb-dev";
process.env.BARBERS_ENV = "dev";
const UID = "boyet-barbershop-owner";
type Branch = { id: string; name: string; priceOverrides?: Record<string, number> };

async function main() {
  const { putState, loadState, getPublicShop } = await import("@/lib/server/shops");
  const { changedLocationPrices, draftFromBranches, setBranchPrice } = await import("@/lib/location-prices");
  const keys = ["barbers.shop-menu", "barbers.shop-locations"];
  const st0 = await loadState(UID, keys);
  const pub0 = await getPublicShop(UID);
  mkdirSync("/workspace/backups", { recursive: true });
  const file = `/workspace/backups/locprice-hardrule-barbersdb-dev-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(file, JSON.stringify(st0, null, 2));
  const locs = JSON.parse(st0["barbers.shop-locations"]!) as { branches: Branch[] };
  const def = (JSON.parse(st0["barbers.shop-menu"]!) as { haircut: { price: number } }).haircut.price;
  const pick = locs.branches.filter((b) => !b.priceOverrides?.haircut).slice(1, 3).map((b) => b.id);
  const draft = { ...draftFromBranches(locs.branches, "haircut"), ...Object.fromEntries(pick.map((id) => [id, "133"])) };
  const changes = changedLocationPrices(locs.branches, "haircut", draft);
  const next = changes.reduce((l, c) => setBranchPrice(l, c.id, "haircut", c.value, def), locs.branches);
  await putState(UID, "barbers.shop-locations", JSON.stringify({ ...locs, branches: next }));
  const st1 = await loadState(UID, keys);
  const pub1 = await getPublicShop(UID);
  const b0 = new Map(locs.branches.map((b) => [b.id, JSON.stringify(b)]));
  const b1 = (JSON.parse(st1["barbers.shop-locations"]!) as { branches: Branch[] }).branches;
  const changed = b1.filter((b) => JSON.stringify(b) !== b0.get(b.id)).map((b) => b.name);
  const pubChanged = (pub1?.branches ?? []).filter((b) => JSON.stringify(pub1!.servicesByLocation[b.id] ?? null) !== JSON.stringify(pub0!.servicesByLocation[b.id] ?? null)).map((b) => b.name);
  console.log(`selected: ${pick.map((id) => locs.branches.find((b) => b.id === id)!.name).join(", ")} -> ₱133`);
  console.log(`stored locations changed: ${changed.length}/${b1.length} [${changed.join(", ")}]`);
  console.log(`public per-location menus changed: [${pubChanged.join(", ")}]`);
  console.log(`menu doc byte-identical: ${st1["barbers.shop-menu"] === st0["barbers.shop-menu"]} · default ₱${(pub1?.services.find((s) => s.id === "haircut")?.price ?? 0) / 100}`);
  await putState(UID, "barbers.shop-locations", st0["barbers.shop-locations"]!);
  const st2 = await loadState(UID, keys);
  console.log(`restored byte-identical: ${st2["barbers.shop-locations"] === st0["barbers.shop-locations"] && st2["barbers.shop-menu"] === st0["barbers.shop-menu"]} · backup ${file}`);
}
if (!process.env.VITEST) void main().catch((e) => { console.error(e); process.exit(1); });
