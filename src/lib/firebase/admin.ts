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

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || "mybarberph";
const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID || "barbersdb";

let app: App | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;

function getApp(): App {
  if (app) return app;
  app = getApps()[0] ?? initializeApp({ projectId: PROJECT_ID, credential: applicationDefault() });
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

export const firebaseProjectId = PROJECT_ID;
export const firestoreDatabaseId = DATABASE_ID;
