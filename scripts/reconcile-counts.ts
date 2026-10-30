/**
 * READ-ONLY reconcile: owner vs barber haircut / sales / share counts per Manila day (v1.0.24 guardrail).
 * Writes NOTHING: every Firestore write method throws before reaching the database. Not scheduled; run by hand.
 *
 *   SEED_ACCESS_TOKEN=$(gcloud auth application-default print-access-token) \
 *   npx vite-node --config scripts/seed.vite.config.ts scripts/reconcile-counts.ts -- --shop <uid> [--days 14]
 *
 * Defaults to barbersdb-dev. Prod needs `--db barbersdb --read-prod` (still read-only) and should only be run with
 * the owner's go-ahead. Exit code 1 if any day mismatches.
 */
import { Firestore } from "@google-cloud/firestore";
import { OAuth2Client } from "google-auth-library";
import { cutBarberId, isFinishedCut, manilaYmd } from "@/lib/cut-count";
import { dayTotals, ownerDayTotal, visitSplit } from "@/lib/counts";

const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const SHOP = arg("--shop"); if (!SHOP) throw new Error("--shop <uid> required");
const DAYS = Math.max(1, Math.min(400, Number(arg("--days") ?? 14)));
const DB = arg("--db") ?? "barbersdb-dev";
if (DB !== "barbersdb-dev" && !process.argv.includes("--read-prod")) throw new Error(`REFUSING ${DB}: pass --read-prod to read (read-only) anything but barbersdb-dev`);
const token = process.env.SEED_ACCESS_TOKEN; if (!token) throw new Error("SEED_ACCESS_TOKEN not set");
const auth = new OAuth2Client(); auth.setCredentials({ access_token: token, expiry_date: Date.now() + 50 * 60_000 });
const raw = new Firestore({ projectId: "mybarberph", databaseId: DB, authClient: auth as never });

const WRITES = new Set(["set", "update", "delete", "create", "add", "batch", "runTransaction", "bulkWriter", "recursiveDelete"]);
const guard = <T extends object>(o: T): T => new Proxy(o, { get(t, k, r) {
  if (typeof k === "string" && WRITES.has(k)) throw new Error(`READ-ONLY GUARD: refused ${k}`);
  const v = Reflect.get(t, k, r); if (typeof v !== "function") return v;
  return (...a: unknown[]) => { const out = v.apply(t, a); return out && typeof out === "object" && !(out instanceof Promise) ? guard(out) : out; };
} });
const db = guard(raw);
try { (db.collection("x").doc("y") as unknown as { set: () => void }).set(); throw new Error("guard failed"); } catch (e) { if (!String(e).includes("READ-ONLY GUARD")) throw e; }

const shop = db.collection("shops").doc(SHOP);
const from = Date.parse(`${manilaYmd(Date.now() - (DAYS - 1) * 86_400_000)}T00:00:00+08:00`);
// Whole-window read, NO limit (this is the reference the app must match).
const rows = (await shop.collection("bookings").where("completedAt", ">=", from).get()).docs.map((d) => ({ ...d.data(), id: d.id })) as never as Parameters<typeof visitSplit>[0][];
const chairs = JSON.parse(((await shop.collection("private").doc("chairs").get()).data()?.json as string) || "[]");
const live = (await shop.collection("bookings").orderBy("createdAt", "desc").limit(300).get()).docs.map((d) => ({ ...d.data(), id: d.id })) as never as typeof rows;

let bad = 0;
console.log(`READ-ONLY reconcile ${DB} shop=${SHOP} days=${DAYS} rows=${rows.length}`);
console.log("day        | owner cuts | Σ links + owner/unassigned | sales Δ | split Δ | newest-300 window | status");
for (let i = DAYS - 1; i >= 0; i--) {
  const day = manilaYmd(Date.now() - i * 86_400_000);
  const owner = ownerDayTotal(rows, chairs, day);
  // Each barber link, using barberDayCuts' exact filter (finished, same location, cutBarberId).
  let links = 0, linkSales = 0;
  for (const c of chairs) {
    const mine = rows.filter((r) => isFinishedCut(r as never) && manilaYmd(r.completedAt!) === day && (r.locationId || "home") === (c.locationId || "home") && cutBarberId(r as never, chairs) === (c.barberId || c.id));
    links += mine.length; linkSales += mine.reduce((n, r) => n + Math.max(0, r.price || 0), 0);
  }
  let rest = 0, restSales = 0;
  const linkKeys = new Set(chairs.map((c: { id: string; barberId?: string; locationId?: string }) => `${c.barberId || c.id}@${c.locationId || "home"}`));
  for (const [k, v] of dayTotals(rows, chairs, day)) if (!linkKeys.has(k)) { rest += v.haircuts; restSales += v.sales; }
  const splitDelta = rows.filter((r) => isFinishedCut(r as never) && manilaYmd(r.completedAt!) === day).reduce((n, r) => { const v = visitSplit(r, chairs); return n + (v.owner + v.barber - v.price); }, 0);
  const windowCuts = ownerDayTotal(live, chairs, day).haircuts;
  const ok = owner.haircuts === links + rest && owner.sales === linkSales + restSales && splitDelta === 0;
  if (!ok) bad++;
  if (owner.haircuts || links) console.log(`${day} | ${String(owner.haircuts).padStart(10)} | ${String(links + rest).padStart(26)} | ${String(owner.sales - linkSales - restSales).padStart(7)} | ${String(splitDelta).padStart(7)} | ${String(windowCuts).padStart(17)} | ${ok ? "ok" : "MISMATCH"}${windowCuts < owner.haircuts ? " (a capped live list would undercount)" : ""}`);
}
console.log(bad ? `${bad} day(s) mismatched` : "all days reconcile");
process.exit(bad ? 1 : 0);
