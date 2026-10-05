import "server-only";

/**
 * Firebase Admin for the single Barbers.ph project (`mybarberph`).
 * Database is selected by FIRESTORE_DATABASE_ID:
 *   barbersdb-dev  — development
 *   barbersdb      — production
 * Auth is shared across both. Uses Application Default Credentials
 * (App Hosting runtime SA, or a local ADC file).
 */
import { applicationDefault, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || "mybarberph";
const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID || "barbersdb";
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
  db = getFirestore(getApp(), DATABASE_ID);
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
export const firestoreDatabaseId = DATABASE_ID;
