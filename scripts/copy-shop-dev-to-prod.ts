/**
 * Copy one shop's SETUP from barbersdb-dev to barbersdb (Jimboy, 2026-10-21, explicit request).
 * Copies: profile (name, address, map pin, photo/logo/payment-QR refs → shop doc), menu (default prices),
 * locations (per-location prices → public branches), chairs/barbers (split, location, links → chairLinks),
 * home service and sales groups. Writes go through putState, so the public shop doc and chairLinks are
 * rebuilt exactly as the app does. Never copies bookings/sales, activity, notifications, reviews, remit, insights.
 * Only shops/{SHOP} and chairLinks pointing at it are written. Prod backup goes to /workspace/backups first.
 *
 *   SEED_ACCESS_TOKEN=... npx vite-node --config scripts/seed.vite.config.ts scripts/copy-shop-dev-to-prod.ts -- [--shop ID] [--yes-this-is-prod]
 *   Without --yes-this-is-prod it is a dry run (reads only).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const args = process.argv.slice(2);
const opt = (n: string, d = "") => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] ?? d : d; };
const SHOP = opt("shop", "3rI8NBFl38fYhelJ73LExnCD2tp1");
const REAL = args.includes("--yes-this-is-prod");
const KEYS = ["barbers.shop-profile", "barbers.shop-menu", "barbers.shop-locations", "barbers.shop-chairs", "barbers.home-service", "barbers.sales-groups"];
const SKIPPED = ["bookings (sales/visits)", "activity", "notifications", "remitClaims", "remitLock", "insights", "companion", "community", "reviews"];
const pht = (t?: number) => (t ? new Date(t).toLocaleString("en-PH", { timeZone: "Asia/Manila" }) : "-");
type Chair = { id: string; barberName?: string; locationId?: string; sharePct?: number | null; shareSet?: boolean; active?: boolean; linkToken?: string; [k: string]: unknown };
type Branch = { id: string; name: string; priceOverrides?: Record<string, number> };

/** Read-only dev client (script runs with the prod database; the dev one is opened separately with the same ADC token). */
async function devFirestore() {
  const { Firestore } = await import("@google-cloud/firestore");
  const { OAuth2Client } = await import("google-auth-library");
  const c = new OAuth2Client(); c.setCredentials({ access_token: process.env.SEED_ACCESS_TOKEN, expiry_date: Date.now() + 50 * 60_000 });
  return new Firestore({ projectId: "mybarberph", databaseId: "barbersdb-dev", authClient: c as never });
}

async function main() {
  if (!/^[A-Za-z0-9]{20,40}$/.test(SHOP)) throw new Error("Bad shop id");
  process.env.PLAN_LIMITS_ENABLED = "0"; // same as apphosting.prod.yaml
  process.env.FIRESTORE_DATABASE_ID = "barbersdb"; process.env.BARBERS_ENV = "prod";
  const { adminDb } = await import("@/lib/firebase/admin");
  const prod = adminDb(), dev = await devFirestore();
  if ((prod as unknown as { databaseId?: string }).databaseId && (prod as unknown as { databaseId: string }).databaseId !== "barbersdb") throw new Error("prod client is not barbersdb");

  const devRef = dev.collection("shops").doc(SHOP), prodRef = prod.collection("shops").doc(SHOP);
  const [devShop, prodShop] = await Promise.all([devRef.get(), prodRef.get()]);
  if (!devShop.exists) throw new Error("Shop not on dev");
  const devPriv = Object.fromEntries((await devRef.collection("private").get()).docs.map((d) => [d.id, d.data()]));
  const prodPriv = (await prodRef.collection("private").get()).docs;
  const prodLinks = (await prod.collection("chairLinks").where("shopId", "==", SHOP).get()).docs;
  const prodSubs = await Promise.all((await prodRef.listCollections()).map(async (c) => `${c.id}:${(await c.count().get()).data().count}`));
  const { STATE_KEYS } = await import("@/lib/server/shops");
  const vals: Record<string, string> = {};
  for (const k of KEYS) { const j = devPriv[STATE_KEYS[k]!]?.json; if (typeof j === "string" && j) vals[k] = j; }

  console.log(`${REAL ? "REAL COPY" : "DRY RUN"} · shop ${SHOP} · dev → prod`);
  console.log(`  prod now: name "${prodShop.data()?.name ?? ""}", branches ${(prodShop.data()?.branches ?? []).length}, private docs ${prodPriv.length}, chairLinks ${prodLinks.length}, subcollections [${prodSubs.join(" ")}]`);
  if (prodPriv.length || prodLinks.length || (prodShop.data()?.branches ?? []).length || prodSubs.length) console.log("  NOTE: prod shop is not an empty placeholder; review the backup before going on.");

  // Storage refs: must resolve (shared bucket mybarberph-shop-photos).
  const prof = JSON.parse(vals["barbers.shop-profile"] ?? "{}");
  const refs = [...(prof.photoUrls ?? []), prof.logoUrl, prof.payQrUrl, prof.payQr?.gcash, prof.payQr?.maya].filter((u): u is string => typeof u === "string" && /^https:/.test(u));
  for (const u of [...new Set(refs)]) {
    const r = await fetch(u, { method: "GET", headers: { Range: "bytes=0-0" } });
    console.log(`  file ${new URL(u).pathname.split("/o/")[1]?.split("?")[0]?.replace(/%2F/g, "/").slice(0, 70)} → ${r.status}${r.ok || r.status === 206 ? " ok" : " NOT FOUND"}`);
  }

  // Chairs: keep tokens unless they already exist on prod for anything else.
  const chairs = JSON.parse(vals["barbers.shop-chairs"] ?? "[]") as Chair[];
  const remap: string[] = [];
  for (const c of chairs) {
    if (!c.linkToken) continue;
    const ex = await prod.collection("chairLinks").doc(c.linkToken).get();
    if (ex.exists && ex.data()?.shopId !== SHOP) {
      const t = randomBytes(9).toString("base64").replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 12).padEnd(12, "0");
      remap.push(`${c.barberName}: token collided, new token`); c.linkToken = t;
    }
  }
  vals["barbers.shop-chairs"] = JSON.stringify(chairs);

  const locs = JSON.parse(vals["barbers.shop-locations"] ?? "{}") as { enabled?: boolean; branches?: Branch[] };
  const menu = JSON.parse(vals["barbers.shop-menu"] ?? "{}") as { haircut?: { price?: number; name?: string }; treatments?: { id: string; name: string; price: number; enabled?: boolean }[] };
  console.log(`  copying: ${KEYS.filter((k) => vals[k]).map((k) => STATE_KEYS[k]).join(", ")}`);
  console.log(`  profile: "${prof.name}", ${prof.address ?? ""}, pin ${prof.location ? "yes" : "no"}, photos ${(prof.photoUrls ?? []).length}, logo ${prof.logoUrl ? "yes" : "no"}, pay QR ${prof.payQrUrl || prof.payQr ? "yes" : "no"}`);
  console.log(`  menu: Haircut ₱${menu.haircut?.price ?? 0}; ${(menu.treatments ?? []).map((t) => `${t.name} ₱${t.price}${t.enabled === false ? " (off)" : ""}`).join(", ")}`);
  console.log(`  locations (enabled ${!!locs.enabled}): ${(locs.branches ?? []).map((b) => `${b.name} ${JSON.stringify(b.priceOverrides ?? {})}`).join("; ")}`);
  console.log(`  barbers: ${chairs.map((c) => `${c.barberName} @${c.locationId ?? "home"} split ${c.sharePct ?? "-"}${c.shareSet ? "" : c.sharePct == null ? "" : ""}${c.active === false ? " inactive" : ""}`).join("; ")}`);
  if (remap.length) console.log(`  ${remap.join("; ")}`);
  console.log(`  skipped: ${SKIPPED.join(", ")}`);
  if (!REAL) return;

  mkdirSync("/workspace/backups", { recursive: true });
  const file = `/workspace/backups/shop-${SHOP}-barbersdb-before-copy-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(file, JSON.stringify({ shop: prodShop.data() ?? null, private: Object.fromEntries(prodPriv.map((d) => [d.id, d.data()])), chairLinks: Object.fromEntries(prodLinks.map((d) => [d.id, d.data()])) }, null, 2));
  console.log(`  backup: ${file}`);

  const { putState } = await import("@/lib/server/shops");
  for (const k of KEYS) if (vals[k]) { await putState(SHOP, k, vals[k]!); console.log(`  wrote ${STATE_KEYS[k]}`); }

  // Read back from prod.
  const s = (await prodRef.get()).data()!;
  const p = Object.fromEntries((await prodRef.collection("private").get()).docs.map((d) => [d.id, d.data()]));
  const links = (await prod.collection("chairLinks").where("shopId", "==", SHOP).get()).docs;
  const svc = (s.menu ?? []) as { id: string; name: string; price: number }[];
  console.log(`\nREAD BACK prod · "${s.name}" · listed ${s.listed} · updated ${pht(s.updatedAt)}`);
  console.log(`  private docs match dev: ${KEYS.filter((k) => vals[k]).map((k) => `${STATE_KEYS[k]} ${p[STATE_KEYS[k]!]?.json === vals[k] ? "✓" : "✗"}`).join(", ")}`);
  console.log(`  defaults: ${svc.map((x) => `${x.name} ₱${x.price / 100}`).join(", ")}`);
  for (const b of (s.branches ?? []) as Branch[]) console.log(`  ${b.name}: ${svc.map((x) => `${x.name} ₱${(b.priceOverrides?.[x.id] ?? x.price) / 100}`).join(", ")}`);
  const pc = JSON.parse(p.chairs?.json ?? "[]") as Chair[];
  for (const c of pc) console.log(`  barber ${c.barberName} @${(s.branches ?? []).find((b: Branch) => b.id === (c.locationId || "home"))?.name ?? c.locationId} split ${c.sharePct ?? "none"}${c.active === false ? " (inactive)" : ""} link ${c.linkToken && links.some((l) => l.id === c.linkToken) ? `https://barbersph.web.app/b/${c.linkToken}` : "none"}`);
}
if (!process.env.VITEST) void main().catch((e) => { console.error(e); process.exit(1); });
