import type { Metadata } from "next";
import { BarberLeaderboard } from "@/features/sales/BarberLeaderboard";

export const metadata: Metadata = { title: "My Barbers" };

export default function BarberLeaderboardPage() {
  return <BarberLeaderboard />;
}
