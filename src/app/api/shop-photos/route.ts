import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, adminStorage, storageBucketName } from "@/lib/firebase/admin";
import { getSessionContext } from "@/lib/firebase/session";
import { FirestoreBarbersRepository } from "@/data/firebase/repository";
import type { Shop } from "@/data";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PHOTOS = 8;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function extFor(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "jpg";
}

function publicUrl(bucket: string, path: string, token: string) {
  const encoded = encodeURIComponent(path);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encoded}?alt=media&token=${token}`;
}

function storagePathFromUrl(url: string, shopId: string): string | null {
  try {
    const u = new URL(url);
    // https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encodedPath}?alt=media
    const m = u.pathname.match(/\/o\/(.+)$/);
    if (!m) return null;
    const path = decodeURIComponent(m[1]!);
    if (!path.startsWith(`shops/${shopId}/photos/`)) return null;
    return path;
  } catch {
    return null;
  }
}

async function loadShop(shopId: string): Promise<Shop> {
  const repo = new FirestoreBarbersRepository(adminDb(), shopId);
  return repo.getShop();
}

/** Upload a shop photo (multipart) and append URL to shop.shopPhotos. */
export async function POST(req: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: "Use a JPG, PNG, WebP, or GIF image." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Photo must be 5 MB or smaller." }, { status: 400 });
    }

    const shop = await loadShop(ctx.shopId);
    const photos = [...(shop.shopPhotos ?? [])];
    if (photos.length >= MAX_PHOTOS) {
      return NextResponse.json({ error: `You can add up to ${MAX_PHOTOS} photos.` }, { status: 400 });
    }

    const id = `ph-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const path = `shops/${ctx.shopId}/photos/${id}.${extFor(file.type)}`;
    const bucketName = storageBucketName();
    const bucket = adminStorage().bucket(bucketName);
    const buffer = Buffer.from(await file.arrayBuffer());
    const token = randomUUID();
    const gcsFile = bucket.file(path);
    await gcsFile.save(buffer, {
      resumable: false,
      metadata: {
        contentType: file.type,
        cacheControl: "public, max-age=31536000",
        metadata: {
          shopId: ctx.shopId,
          uploadedBy: ctx.uid,
          firebaseStorageDownloadTokens: token,
        },
      },
    });

    const url = publicUrl(bucketName, path, token);
    photos.push(url);
    const coverPhoto = shop.coverPhoto || url;
    await adminDb().doc(`shops/${ctx.shopId}`).update({ shopPhotos: photos, coverPhoto });

    const next = await loadShop(ctx.shopId);
    return NextResponse.json({ result: next });
  } catch (err) {
    console.error("shop-photos POST", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Upload failed" }, { status: 500 });
  }
}

/** Remove a shop photo by URL, or set cover. */
export async function DELETE(req: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { url?: string; setCover?: string };
    const shop = await loadShop(ctx.shopId);

    if (body.setCover) {
      const photos = shop.shopPhotos ?? [];
      if (!photos.includes(body.setCover)) {
        return NextResponse.json({ error: "Cover must be one of your shop photos." }, { status: 400 });
      }
      await adminDb().doc(`shops/${ctx.shopId}`).update({ coverPhoto: body.setCover });
      return NextResponse.json({ result: await loadShop(ctx.shopId) });
    }

    const url = body.url;
    if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

    const photos = (shop.shopPhotos ?? []).filter((u) => u !== url);
    const coverPhoto = shop.coverPhoto === url ? (photos[0] ?? FieldValue.delete()) : shop.coverPhoto;

    const path = storagePathFromUrl(url, ctx.shopId);
    if (path) {
      try {
        await adminStorage().bucket(storageBucketName()).file(path).delete({ ignoreNotFound: true });
      } catch (e) {
        console.warn("shop-photos delete storage", e);
      }
    }

    await adminDb().doc(`shops/${ctx.shopId}`).update({
      shopPhotos: photos,
      coverPhoto,
    });

    return NextResponse.json({ result: await loadShop(ctx.shopId) });
  } catch (err) {
    console.error("shop-photos DELETE", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Remove failed" }, { status: 500 });
  }
}

/** Set cover via POST action=setCover for simpler clients — also support PATCH. */
export async function PATCH(req: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const body = (await req.json().catch(() => ({}))) as { coverPhoto?: string };
    if (!body.coverPhoto) return NextResponse.json({ error: "Missing coverPhoto" }, { status: 400 });
    const shop = await loadShop(ctx.shopId);
    if (!(shop.shopPhotos ?? []).includes(body.coverPhoto)) {
      return NextResponse.json({ error: "Cover must be one of your shop photos." }, { status: 400 });
    }
    await adminDb().doc(`shops/${ctx.shopId}`).update({ coverPhoto: body.coverPhoto });
    return NextResponse.json({ result: await loadShop(ctx.shopId) });
  } catch (err) {
    console.error("shop-photos PATCH", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Update failed" }, { status: 500 });
  }
}
