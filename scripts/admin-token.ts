/**
 * Script-only stand-in for src/lib/firebase/admin.ts (wired by scripts/seed.vite.config.ts).
 * Same exports and database guard, but uses an access token from SEED_ACCESS_TOKEN, minted from this machine's
 * ADC with `gcloud auth application-default print-access-token` (for accounts under Workspace re-auth, where the
 * Node library's own refresh fails with invalid_rapt). The token is never printed or stored. Never used by the app.
 */
import { Firestore } from "@google-cloud/firestore";
import { Storage } from "@google-cloud/storage";
import { OAuth2Client } from "google-auth-library";
import { DATABASES, resolveDatabaseId } from "../src/lib/firebase/admin";

const PROJECT_ID = "mybarberph";
const BUCKET = process.env.FIREBASE_STORAGE_BUCKET || "mybarberph-shop-photos";
const token = process.env.SEED_ACCESS_TOKEN || "";
if (!token) throw new Error("SEED_ACCESS_TOKEN is empty: run with SEED_ACCESS_TOKEN=$(gcloud auth application-default print-access-token)");
const authClient = new OAuth2Client();
authClient.setCredentials({ access_token: token, expiry_date: Date.now() + 50 * 60_000 });

let db: Firestore | undefined;
let storage: Storage | undefined;
export { DATABASES, resolveDatabaseId };
export function adminDb() { return (db ??= new Firestore({ projectId: PROJECT_ID, databaseId: resolveDatabaseId(), authClient: authClient as never, ignoreUndefinedProperties: true })); }
export function adminStorage() { return (storage ??= new Storage({ projectId: PROJECT_ID, authClient: authClient as never })); }
export function adminAuth(): never { throw new Error("adminAuth is not available in seed scripts"); }
export function storageBucketName() { return BUCKET; }
export const firebaseProjectId = PROJECT_ID;
export function firestoreDatabaseId() { return resolveDatabaseId(); }
