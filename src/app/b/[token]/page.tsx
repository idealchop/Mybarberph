import type { Metadata } from "next";
import { BarberLinkScreen } from "@/features/barber/BarberLinkScreen";

export const metadata: Metadata = { title: "Barber link" };

/** Private page opened from the link the shop sends a barber. No account. */
export default async function BarberLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <BarberLinkScreen token={token} />;
}
