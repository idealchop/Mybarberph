import { json } from "@/lib/server/auth";

/** Barbers can't rename themselves; the shop owner sets names in My Barbers. */
export async function PUT() {
  return json({ error: "Only the shop can change your name." }, 403);
}
