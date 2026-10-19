import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

/**
 * Every page is noindex today (root layout `robots`): the app shell, the booking pages and the legal
 * pages, whose text is still a draft for legal review. Dev and any non-prod host block all crawling;
 * prod blocks only the API. Revisit when the legal text is final (docs/compliance open items).
 */
export default function robots(): MetadataRoute.Robots {
  if (process.env.BARBERS_ENV !== "prod") return { rules: [{ userAgent: "*", disallow: "/" }] };
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }] };
}
