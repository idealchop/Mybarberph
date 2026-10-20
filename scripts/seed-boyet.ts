/**
 * Seeds Jimboy's real demo owner account: Boyet Barbershop (since 2014). No visits or sales are created.
 *
 * Idempotent: stable ids for branches, barbers and chairs; existing barber link tokens are kept; re-running
 * rewrites the same docs. Goes through the app's own server writers (putState), so the shop doc, branch list,
 * menu and chairLinks are mirrored exactly as the app does it.
 *
 * DEV (default):
 *   npx vite-node --config vitest.config.ts scripts/seed-boyet.ts -- --uid boyet-barbershop-owner
 * PROD (only after DEV is checked; needs the explicit flag):
 *   npx vite-node --config vitest.config.ts scripts/seed-boyet.ts -- --db barbersdb --yes-this-is-prod --uid <uid>
 * Options: --dry-run (print the plan, write nothing), --no-logo.
 *
 * Needs Application Default Credentials for project mybarberph (gcloud auth application-default login).
 * Accounts under Workspace re-auth (the Node library's refresh fails with invalid_rapt): right after logging in, run
 *   SEED_ACCESS_TOKEN="$(gcloud auth application-default print-access-token)" \
 *     npx vite-node --config scripts/seed.vite.config.ts scripts/seed-boyet.ts -- --uid boyet-barbershop-owner
 * (scripts/admin-token.ts stands in for the Admin module; the token is never printed or stored.)
 * The owner's Firebase Auth user (phone +639995199685) is project-wide; its uid is the shop id.
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string, d = "") => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] ?? d : d; };

const DB = opt("db", "barbersdb-dev");
const UID = opt("uid", "boyet-barbershop-owner");
const DRY = flag("dry-run");
const LOGO = opt("logo", "/workspace/boyet-logo.png");
if (DB !== "barbersdb-dev" && DB !== "barbersdb") throw new Error(`Unknown database ${DB}`);
if (DB === "barbersdb" && !flag("yes-this-is-prod")) throw new Error("Refusing to write PROD (barbersdb) without --yes-this-is-prod.");
if (!/^[\w-]{6,128}$/.test(UID)) throw new Error("Bad --uid");
process.env.FIRESTORE_DATABASE_ID = DB;
process.env.BARBERS_ENV = DB === "barbersdb" ? "prod" : "dev";

type Pin = { lat: number; lng: number; approx?: string };
/** Branches in the order Jimboy gave them. The first is the original shop ("home"). Pins: OpenStreetMap Nominatim. */
const BRANCHES: { slug: string; area: string; address: string; pin: Pin; barbers: string[] }[] = [
  { slug: "bayan", area: "Bayan", address: "Bayan, Brgy. 3, Cabuyao/Santa Rosa, Laguna", pin: { lat: 14.27435, lng: 121.12334 }, barbers: ["Eddie Emperador"] },
  { slug: "niugan", area: "Niugan", address: "Niugan, Cabuyao City, Laguna", pin: { lat: 14.26392, lng: 121.12878, approx: "barangay center" }, barbers: ["Jery Aranil"] },
  { slug: "katapatan-homes", area: "Katapatan Homes", address: "Katapatan Homes, Cabuyao City, Laguna", pin: { lat: 14.26, lng: 121.13348 }, barbers: ["Vincent Tamayosa", "Gaping Cristopher", "Airon Torres"] },
  { slug: "banay-banay", area: "Banay-Banay", address: "Banay-Banay, Cabuyao City, Laguna", pin: { lat: 14.25263, lng: 121.12887, approx: "barangay center" }, barbers: ["Glenmar Paclibar", "Ernie Dela Cruz"] },
  { slug: "cantuban-homes", area: "Cantuban Homes", address: "Cantuban Homes", pin: { lat: 14.2735, lng: 121.1255, approx: "not on OpenStreetMap; Cabuyao town area" }, barbers: ["Jemuel Gomez"] },
  { slug: "lakeside-phase-3", area: "Lakeside Phase 3", address: "Lakeside Phase 3", pin: { lat: 14.26375, lng: 121.1444, approx: "phase not on OpenStreetMap; nearest 'Lakeside' match, Gulod, Cabuyao" }, barbers: ["MJ Vercelles", "Ellie Aldiano"] },
  { slug: "hong-kong-village", area: "Hong Kong Village", address: "Hong Kong Village Subdivision", pin: { lat: 14.25036, lng: 121.12318 }, barbers: ["Raymart Cagi", "Mark Villa Flores"] },
  { slug: "sala", area: "Sala", address: "Barangay Sala, Cabuyao City, Laguna", pin: { lat: 14.26674, lng: 121.12002, approx: "barangay center" }, barbers: ["Allan Tamayo"] },
  { slug: "dita", area: "Dita", address: "Barangay Dita, Santa Rosa City, Laguna", pin: { lat: 14.28261, lng: 121.11114, approx: "barangay center" }, barbers: ["Nel Gorobat"] },
  { slug: "riverstone", area: "Riverstone", address: "Riverstone", pin: { lat: 14.28042, lng: 121.11449, approx: "matched Grand Riverstone Village, Dita, Santa Rosa" }, barbers: ["Jomar Ramos"] },
  { slug: "dila", area: "Dila", address: "Barangay Dila, Santa Rosa City, Laguna", pin: { lat: 14.28985, lng: 121.10959, approx: "barangay center" }, barbers: ["Cris Alata"] },
  { slug: "lakeside-phase-4", area: "Lakeside Phase 4", address: "Lakeside Phase 4", pin: { lat: 14.2652, lng: 121.1458, approx: "phase not on OpenStreetMap; placed next to Lakeside Phase 3" }, barbers: ["Ronie Teves"] },
  { slug: "southville", area: "Southville", address: "Southville, Cabuyao City, Laguna", pin: { lat: 14.26853, lng: 121.14314, approx: "matched Southville 1, Niugan" }, barbers: ["James Gaban"] },
  { slug: "dita-rotonda", area: "Dita Rotonda", address: "Dita Rotonda, Santa Rosa City, Laguna", pin: { lat: 14.28267, lng: 121.11127 }, barbers: ["Bon Baksobia"] },
  { slug: "windfield", area: "Windfield", address: "Windfield", pin: { lat: 14.26127, lng: 121.14893, approx: "matched St. Joseph Windfield 2, Gulod, Cabuyao" }, barbers: ["Jessan Argonillo"] },
];
// Prices in pesos (Jimboy to confirm). The app's model is one haircut plus optional add-ons.
const MENU = {
  haircut: { name: "Haircut", durationMins: 30, price: 150, icon: "clipper" },
  treatments: [
    { id: "shave", name: "Shave", durationMins: 15, price: 80, icon: "razor" },
    { id: "kids-cut", name: "Kids cut", durationMins: 25, price: 120, icon: "scissors" },
    { id: "beard-trim", name: "Beard trim", durationMins: 15, price: 60, icon: "razor" },
  ],
};
const NAME = "Boyet Barbershop";
const branchId = (i: number, slug: string) => (i === 0 ? "home" : `loc-${slug}`);
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const formatted = (b: (typeof BRANCHES)[number]) => b.address;
const area = (b: (typeof BRANCHES)[number]) => b.address.includes(",") ? b.address.split(",").slice(-2).join(",").trim() : "Cabuyao, Laguna";
const token = () => { const a = "23456789abcdefghjkmnpqrstuvwxyz"; return [...randomBytes(12)].map((x) => a[x % a.length]).join(""); };

async function main() {
  const { adminDb, adminStorage, storageBucketName } = await import("@/lib/firebase/admin");
  const { ensureShop, putState, loadState } = await import("@/lib/server/shops");
  console.log(`Target: ${DB} · shop ${UID}${DRY ? " · DRY RUN" : ""}`);

  const prev = DRY ? {} : await loadState(UID, ["barbers.shop-chairs", "barbers.shop-profile"]);
  const oldChairs = JSON.parse(prev["barbers.shop-chairs"] || "[]") as { id: string; linkToken?: string; linkReviewAt?: number }[];
  const oldProfile = JSON.parse(prev["barbers.shop-profile"] || "{}") as { logoUrl?: string; photoUrls?: string[] };

  let logoUrl = oldProfile.logoUrl || "";
  if (!flag("no-logo") && !logoUrl && !DRY) {
    const t = randomBytes(16).toString("hex");
    const path = `shops/${UID}/photos/logo-boyet.png`;
    await adminStorage().bucket(storageBucketName()).file(path).save(readFileSync(LOGO), { contentType: "image/png", resumable: false, metadata: { cacheControl: "public, max-age=31536000", metadata: { firebaseStorageDownloadTokens: t } } });
    logoUrl = `https://firebasestorage.googleapis.com/v0/b/${storageBucketName()}/o/${encodeURIComponent(path)}?alt=media&token=${t}`;
  }

  const home = BRANCHES[0]!;
  const loc = (b: (typeof BRANCHES)[number]) => ({ lat: b.pin.lat, lng: b.pin.lng, formattedAddress: formatted(b) });
  const profile = {
    name: NAME, address: home.address, phone: "", area: area(home), about: "Since 2014.", location: loc(home),
    photoUrls: logoUrl ? [logoUrl] : oldProfile.photoUrls ?? [], logoUrl, locations: BRANCHES.reduce((n, b) => n + b.barbers.length, 0), hours: "",
  };
  // One barber per branch (Jimboy, 2026-10-20): a place with several barbers becomes "Name I", "Name II", …
  // (same address and pin; ids "<id>", "<id>-2", …). Names are the place only; the app shows the shop name itself.
  const ROMAN = ["I", "II", "III", "IV", "V", "VI"];
  const seats = BRANCHES.flatMap((b, i) => b.barbers.map((barber, k) => ({
    b, barber, id: k === 0 ? branchId(i, b.slug) : `${branchId(i, b.slug)}-${k + 1}`,
    name: b.barbers.length > 1 ? `${b.area} ${ROMAN[k]}` : b.area,
  })));
  const locations = {
    enabled: true, viewId: "all",
    branches: seats.map(({ b, id, name }) => ({ id, name, area: area(b), address: b.address, phone: "", about: "", location: loc(b), photoUrls: [] })),
  };
  let n = 0;
  const chairs = seats.map(({ barber: name, id: locationId }) => {
    const id = `c-${slugify(name)}`, old = oldChairs.find((c) => c.id === id);
    const review = new Date(); review.setMonth(review.getMonth() + 6);
    return { id, number: ++n, label: name, barberId: `b-${slugify(name)}`, barberName: name, locationId, active: true, linkToken: old?.linkToken || token(), linkReviewAt: old?.linkReviewAt || review.getTime() };
  });

  for (const b of BRANCHES) console.log(`  ${b.area.padEnd(18)} ${b.barbers.join(", ")}${b.pin.approx ? `  [pin approx: ${b.pin.approx}]` : ""}`);
  console.log(`  ${chairs.length} barbers · menu ₱${MENU.haircut.price} haircut + ${MENU.treatments.length} add-ons · plan lifetime_unlimited · logo ${logoUrl ? "yes" : "no"}`);
  if (DRY) return;

  await ensureShop(UID);
  // Plan first: the branch limit is checked against it.
  await adminDb().collection("shops").doc(UID).set({ ownerUid: UID, plan: "lifetime_unlimited", planStatus: "active", planRenewsAt: null }, { merge: true });
  await putState(UID, "barbers.shop-profile", JSON.stringify(profile));
  await putState(UID, "barbers.shop-locations", JSON.stringify(locations));
  await putState(UID, "barbers.shop-menu", JSON.stringify(MENU));
  await putState(UID, "barbers.shop-chairs", JSON.stringify(chairs));
  const links = await adminDb().collection("chairLinks").where("shopId", "==", UID).get();
  console.log(`Done. chairLinks: ${links.size}. Visits/sales: none (by design).`);
}
main().then(() => process.exit(0), (e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
