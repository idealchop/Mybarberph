"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "mybarberph.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "mybarberph",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
};

export const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === "true";

let auth: Auth | null = null;

export function firebaseApp(): FirebaseApp {
  if (!config.apiKey) {
    throw new Error("Missing NEXT_PUBLIC_FIREBASE_API_KEY. Copy .env.example to .env.local.");
  }
  return getApps().length ? getApp() : initializeApp(config);
}

export function firebaseAuth(): Auth {
  if (auth) return auth;
  auth = getAuth(firebaseApp());
  if (useEmulators) {
    connectAuthEmulator(auth, process.env.NEXT_PUBLIC_AUTH_EMULATOR_URL ?? "http://127.0.0.1:9099", { disableWarnings: true });
  }
  return auth;
}

export const isFirebaseConfigured = () => Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
