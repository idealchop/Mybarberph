import { randomUUID } from "node:crypto";
import { adminStorage, storageBucketName } from "@/lib/firebase/admin";
import { badRequest, getCaller, json, unauthorized } from "@/lib/server/auth";

const MAX = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Uploads a shop photo to gs://<bucket>/shops/{uid}/photos/… and returns a public download URL. */
export async function POST(req: Request) {
  const me = await getCaller(req);
  if (!me) return unauthorized();
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return badRequest("No file");
  const ext = TYPES[file.type];
  if (!ext) return badRequest("Use a JPG, PNG or WebP photo.");
  if (file.size > MAX) return badRequest("Photos must be 5 MB or smaller.");
  const token = randomUUID();
  const path = `shops/${me.uid}/photos/${Date.now().toString(36)}-${token.slice(0, 8)}.${ext}`;
  await adminStorage().bucket(storageBucketName()).file(path).save(Buffer.from(await file.arrayBuffer()), {
    contentType: file.type, resumable: false,
    metadata: { cacheControl: "public, max-age=31536000", metadata: { firebaseStorageDownloadTokens: token } },
  });
  const url = `https://firebasestorage.googleapis.com/v0/b/${storageBucketName()}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
  return json({ url, path });
}
