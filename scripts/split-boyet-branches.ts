/**
 * One barber per branch for Boyet Barbershop (Jimboy, 2026-10-20).
 * - A branch with several barbers is split into numbered branches: "Katapatan Homes I", "… II", "… III".
 *   The original keeps its id (and becomes "I"); the new ones get "<id>-2", "<id>-3" with the same address and pin.
 * - Branch names lose the shop-name prefix ("Boyet Barbershop – Bayan" -> "Bayan").
 * - Branches that are already numbered siblings (e.g. prod's "Hongkong Village II") are renamed into the same family
 *   ("Hong Kong Village I" / "Hong Kong Village II").
 * - Barbers keep their chair ids and link tokens; only the chair's locationId changes. Writes go through putState,
 *   so the public shop doc copy of branches is updated the same way the app does it.
 * Backup of the two private docs is written to /workspace/backups before anything is changed.
 *
 *   SEED_ACCESS_TOKEN="$(gcloud auth application-default print-access-token)" \
 *     npx vite-node --config scripts/seed.vite.config.ts scripts/split-boyet-branches.ts -- [--dry-run]
 *   Prod: add --db barbersdb --yes-this-is-prod
 */
import { mkdirSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string, d = "") => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] ?? d : d; };
const DB = opt("db", "barbersdb-dev");
const UID = opt("uid", "boyet-barbershop-owner");
const DRY = flag("dry-run");
if (DB !== "barbersdb-dev" && DB !== "barbersdb") throw new Error(`Unknown database ${DB}`);
if (DB === "barbersdb" && !flag("yes-this-is-prod")) throw new Error("Refusing to write PROD (barbersdb) without --yes-this-is-prod.");
process.env.FIRESTORE_DATABASE_ID = DB;
process.env.BARBERS_ENV = DB === "barbersdb" ? "prod" : "dev";

type Branch = { id: string; name: string; [k: string]: unknown };
type Chair = { id: string; number?: number; barberName?: string; locationId?: string; linkToken?: string; [k: string]: unknown };
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const NUM_RE = /\s+(X|IX|VIII|VII|VI|V|IV|III|II|I)$/;
const familyKey = (name: string) => name.replace(NUM_RE, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const numeralOf = (name: string) => { const m = NUM_RE.exec(name); return m ? ROMAN.indexOf(m[1]!) + 1 : 0; };

export function plan(shopName: string, branches: Branch[], chairs: Chair[]) {
  const prefixes = [shopName, "Boyet Barbershop", "Boyet Barbers"].filter(Boolean).map((p) => new RegExp(`^${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[–-]\\s*`, "i"));
  const strip = (n: string) => prefixes.reduce((s, re) => s.replace(re, ""), n).trim();
  const out: Branch[] = [];
  const nextChairs = chairs.map((c) => ({ ...c }));
  for (const b of branches) {
    const base = { ...b, name: strip(b.name) };
    out.push(base);
    const here = nextChairs.filter((c) => c.locationId === b.id).sort((x, y) => (x.number ?? 0) - (y.number ?? 0));
    here.slice(1).forEach((c, i) => {
      const id = `${b.id}-${i + 2}`;
      if (!out.some((x) => x.id === id) && !branches.some((x) => x.id === id)) out.push({ ...base, id });
      c.locationId = id;
    });
  }
  // Number every family of same-named branches: I, II, III (original first, then any already-numbered ones).
  const families = new Map<string, Branch[]>();
  for (const b of out) { const k = familyKey(b.name); families.set(k, [...(families.get(k) ?? []), b]); }
  for (const fam of families.values()) {
    if (fam.length < 2) continue;
    const head = fam.find((b) => numeralOf(b.name) === 0) ?? fam[0]!;
    const baseName = head.name.replace(NUM_RE, "");
    const ordered = [...fam].sort((a, b) => (a === head ? -1 : b === head ? 1 : (numeralOf(a.name) || 99) - (numeralOf(b.name) || 99)));
    ordered.forEach((b, i) => { b.name = `${baseName} ${ROMAN[i]}`; });
  }
  return { branches: out, chairs: nextChairs };
}

async function main() {
  const { putState, loadState } = await import("@/lib/server/shops");
  const st = await loadState(UID, ["barbers.shop-locations", "barbers.shop-chairs", "barbers.shop-profile"]);
  const locations = JSON.parse(st["barbers.shop-locations"] || "{}") as { branches?: Branch[] };
  const chairs = JSON.parse(st["barbers.shop-chairs"] || "[]") as Chair[];
  const profile = JSON.parse(st["barbers.shop-profile"] || "{}") as { name?: string };
  const next = plan(profile.name || "Boyet Barbershop", locations.branches ?? [], chairs);
  console.log(`Target: ${DB} · shop ${UID}${DRY ? " · DRY RUN" : ""}`);
  for (const b of next.branches) {
    const who = next.chairs.filter((c) => c.locationId === b.id).map((c) => c.barberName).join(", ") || "(no barber)";
    console.log(`  ${b.id.padEnd(26)} ${String(b.name).padEnd(22)} ${who}`);
  }
  const multi = next.branches.filter((b) => next.chairs.filter((c) => c.locationId === b.id).length > 1);
  console.log(`  ${next.branches.length} branches · ${next.chairs.length} barbers · branches with >1 barber: ${multi.length}`);
  if (DRY) return;
  mkdirSync("/workspace/backups", { recursive: true });
  const file = `/workspace/backups/boyet-${DB}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(file, JSON.stringify(st, null, 2));
  console.log(`  backup: ${file}`);
  await putState(UID, "barbers.shop-locations", JSON.stringify({ ...locations, branches: next.branches }));
  await putState(UID, "barbers.shop-chairs", JSON.stringify(next.chairs));
  console.log("Done.");
}
if (!process.env.VITEST) void main().catch((e) => { console.error(e); process.exit(1); });
