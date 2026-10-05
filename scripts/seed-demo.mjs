/**
 * Creates (or resets) the demo shop owner and seeds Kanto Kings into the DEV database
 * (barbersdb-dev) of the single Firebase project mybarberph.
 *
 *   node --env-file=.env.local scripts/seed-demo.mjs
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { register as registerLoader } from "node:module";
import { pathToFileURL } from "node:url";
import { register } from "tsx/esm/api";

registerLoader("./scripts/stub-server-only.mjs", pathToFileURL("./"));

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && existsSync(resolve(".secret.user-adc.json"))) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = resolve(".secret.user-adc.json");
}
process.env.GCLOUD_PROJECT ??= "mybarberph";
process.env.FIRESTORE_DATABASE_ID ??= "barbersdb-dev";

register();

const { initializeApp, applicationDefault, getApps } = await import("firebase-admin/app");
const { getAuth } = await import("firebase-admin/auth");
const { getFirestore } = await import("firebase-admin/firestore");
const { seedDemoShop } = await import("../src/data/firebase/seed-shop.ts");

const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || "barbersdb-dev";
const DEMO_EMAIL = process.env.DEMO_OWNER_EMAIL || "owner@kantokings.ph";
const DEMO_PASSWORD = process.env.DEMO_OWNER_PASSWORD || "BarbersPh!demo";
const DEMO_SHOP_ID = "kanto-kings";

if (!getApps().length) {
  initializeApp({ projectId: "mybarberph", credential: applicationDefault() });
}
const db = getFirestore(DATABASE_ID);
db.settings({ ignoreUndefinedProperties: true });
const auth = getAuth();

let user;
try {
  user = await auth.getUserByEmail(DEMO_EMAIL);
  console.log("demo user exists", user.uid);
} catch {
  user = await auth.createUser({ email: DEMO_EMAIL, password: DEMO_PASSWORD, displayName: "Jimboy", emailVerified: true });
  console.log("created demo user", user.uid);
}

const { shopId } = await seedDemoShop(db, { uid: user.uid, email: DEMO_EMAIL, displayName: "Jimboy" }, {
  shopId: DEMO_SHOP_ID,
  shopName: "Kanto Kings Barbershop",
  tier: "paid",
});
console.log(`seeded shop ${shopId} into ${DATABASE_ID}`);
console.log(`\nSign in at /login with:\n  email:    ${DEMO_EMAIL}\n  password: ${DEMO_PASSWORD}\n`);
