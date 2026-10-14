"use client";
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "mybarberph.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "mybarberph",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "mybarberph-shop-photos",
};

export const isFirebaseConfigured = () => Boolean(config.apiKey);

export function firebaseApp(): FirebaseApp {
  if (!config.apiKey) throw new Error("Sign-in is not configured (NEXT_PUBLIC_FIREBASE_API_KEY is missing).");
  return getApps().length ? getApp() : initializeApp(config);
}

let auth: Auth | null = null;
export function firebaseAuth(): Auth {
  if (!auth) auth = getAuth(firebaseApp());
  return auth;
}
