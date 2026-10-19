import type { Metadata } from "next";
import { BarberLinkScreen } from "@/features/barber";

/** Installing from a barber link must reopen that link, so each link has its own manifest. */
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  return { title: "Barber link", manifest: `/api/barber/${encodeURIComponent(token)}/manifest` };
}

/** Private page opened from the link the shop sends a barber. No account. */
export default async function BarberLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <BarberLinkScreen token={token} />;
}
