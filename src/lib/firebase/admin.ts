import "server-only";

/**
 * Firebase Admin for the single Barbers.ph project (`mybarberph`).
 * Database is selected by FIRESTORE_DATABASE_ID, set explicitly per environment (apphosting.dev.yaml /
 * apphosting.prod.yaml, or your local env file):
 *   barbersdb-dev  — development
 *   barbersdb      — production
 * There is no default. If it is missing or unknown, or doesn't match BARBERS_ENV, the first database call
 * throws a clear error instead of silently using production data.
 * Auth is shared across both. Uses Application Default Credentials
 * (App Hosting runtime SA, or a local ADC file).
 */
import { applicationDefault, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || "mybarberph";
export const DATABASES = { dev: "barbersdb-dev", prod: "barbersdb" } as const;

/** The configured database, or a clear error. Pure, so it can be tested without Firebase. */
export function resolveDatabaseId(env: Record<string, string | undefined> = process.env): string {
  const id = (env.FIRESTORE_DATABASE_ID || env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID || "").trim();
  if (!id) throw new Error("FIRESTORE_DATABASE_ID is not set. Set it to barbersdb-dev (dev) or barbersdb (prod); there is no default.");
  if (id !== DATABASES.dev && id !== DATABASES.prod) throw new Error(`FIRESTORE_DATABASE_ID "${id}" is not a Barbers.ph database (expected barbersdb-dev or barbersdb).`);
  const stage = env.BARBERS_ENV;
  if ((stage === "dev" || stage === "prod") && id !== DATABASES[stage]) {
    throw new Error(`BARBERS_ENV=${stage} must use ${DATABASES[stage]}, but FIRESTORE_DATABASE_ID is ${id}.`);
  }
  return id;
}
/** Custom bucket (default Firebase *.firebasestorage.app needs Console Get Started). */
const STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
  process.env.FIREBASE_STORAGE_BUCKET ||
  "mybarberph-shop-photos";

let app: App | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;
let storage: Storage | undefined;

function getApp(): App {
  if (app) return app;
  app = getApps()[0] ?? initializeApp({
    projectId: PROJECT_ID,
    credential: applicationDefault(),
    storageBucket: STORAGE_BUCKET,
  });
  return app;
}

export function adminDb(): Firestore {
  if (db) return db;
  db = getFirestore(getApp(), resolveDatabaseId());
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

export function adminAuth(): Auth {
  if (auth) return auth;
  auth = getAuth(getApp());
  return auth;
}

export function adminStorage(): Storage {
  if (storage) return storage;
  storage = getStorage(getApp());
  return storage;
}

export function storageBucketName() {
  return STORAGE_BUCKET;
}

export const firebaseProjectId = PROJECT_ID;
/** The configured database id (throws when not configured; see resolveDatabaseId). */
export function firestoreDatabaseId() { return resolveDatabaseId(); }
