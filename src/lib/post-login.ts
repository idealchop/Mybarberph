"use client";

/**
 * After Auth succeeds (and the session cookie is set), send the user to the
 * right home: Paid → /dashboard, Partner → /partner. Ensures a shop exists.
 */
export async function ensureShopAndRedirect(router: { replace: (href: string) => void }, opts?: { shopName?: string }) {
  const userRes = await fetch("/api/auth/ensure-shop", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shopName: opts?.shopName }),
  });
  if (!userRes.ok) {
    const body = await userRes.json().catch(() => ({}));
    throw new Error(body.error || "Could not open your shop.");
  }
  const { tier } = (await userRes.json()) as { tier?: string };
  router.replace(tier === "partner" ? "/partner" : "/dashboard");
}
