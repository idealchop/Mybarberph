"use client";
import { fileToDataUrl } from "@/features/community";
import { api } from "@/lib/cloud";

/** Resizes a photo in the browser and uploads it to the shop's Storage folder. Returns the public URL. */
export async function uploadPhoto(file: File, maxSide = 1280, quality = 0.82): Promise<string> {
  const dataUrl = await fileToDataUrl(file, maxSide, quality);
  const blob = await (await fetch(dataUrl)).blob();
  const form = new FormData();
  form.append("file", new File([blob], "photo.jpg", { type: "image/jpeg" }));
  try {
    const d = await api("/api/shop/photos", { method: "POST", body: form });
    return d.url as string;
  } catch (e) {
    if ((e as { status?: number }).status === 401) throw new Error("Sign in to add photos.");
    throw e;
  }
}
