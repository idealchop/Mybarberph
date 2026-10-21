/**
 * Income split for Boyet Barbershop (Jimboy, 2026-10-21): every barber at 50%, as an explicit owner choice
 * (sharePct 50 + shareSet true, so it doesn't read as None). Writes the chairs list through putState
 * (what the app reads). Backup of the chairs goes to /workspace/backups first.
 *
 *   SEED_ACCESS_TOKEN="$(gcloud auth application-default print-access-token)" \
 *     npx vite-node --config scripts/seed.vite.config.ts scripts/set-boyet-split.ts -- [--dry-run] [--pct 50]
 *   Prod: add --db barbersdb --yes-this-is-prod (dry run needs no guard; it writes nothing)
 */
import { mkdirSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string, d = "") => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] ?? d : d; };
const DB = opt("db", "barbersdb-dev");
const UID = opt("uid", "boyet-barbershop-owner");
const PCT = Number(opt("pct", "50"));
const DRY = flag("dry-run");
if (DB !== "barbersdb-dev" && DB !== "barbersdb") throw new Error(`Unknown database ${DB}`);
if (!(Number.isInteger(PCT) && PCT >= 0 && PCT <= 100)) throw new Error("--pct must be 0–100");
if (DB === "barbersdb" && !DRY && !flag("yes-this-is-prod")) throw new Error("Refusing to write PROD (barbersdb) without --yes-this-is-prod.");
process.env.FIRESTORE_DATABASE_ID = DB;
process.env.BARBERS_ENV = DB === "barbersdb" ? "prod" : "dev";

async function main() {
  const { putState, loadState } = await import("@/lib/server/shops");
  const { sharePct } = await import("@/lib/income-split");
  const st = await loadState(UID, ["barbers.shop-chairs"]);
  const chairs = JSON.parse(st["barbers.shop-chairs"] || "[]") as { id: string; barberName?: string; label?: string; sharePct?: number | null; shareSet?: boolean }[];
  console.log(`Target: ${DB} · shop ${UID} · ${chairs.length} barbers${DRY ? " · DRY RUN (no writes)" : ""}`);
  for (const c of chairs) console.log(`  ${(c.barberName || c.label || c.id).padEnd(22)} now ${sharePct(c) ?? "None"} -> ${PCT}%`);
  const next = chairs.map((c) => ({ ...c, sharePct: PCT, shareSet: true }));
  const ok = next.every((c) => sharePct(c) === PCT);
  console.log(`  after: ${next.filter((c) => sharePct(c) === PCT).length}/${next.length} at ${PCT}% (explicit)${ok ? "" : " · CHECK FAILED"}`);
  if (DRY || !ok) return;
  mkdirSync("/workspace/backups", { recursive: true });
  const file = `/workspace/backups/boyet-split-${DB}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(file, JSON.stringify(st, null, 2));
  console.log(`  backup: ${file}`);
  await putState(UID, "barbers.shop-chairs", JSON.stringify(next));
  const back = JSON.parse((await loadState(UID, ["barbers.shop-chairs"]))["barbers.shop-chairs"] || "[]") as typeof chairs;
  console.log(`  read back: ${back.filter((c) => sharePct(c) === PCT && c.shareSet === true).length}/${back.length} at ${PCT}% (explicit)`);
}
if (!process.env.VITEST) void main().catch((e) => { console.error(e); process.exit(1); });
