import { redirect } from "next/navigation";

// The leaderboard is now the My Barbers tab on Sales.
export default function BarberLeaderboardPage() {
  redirect("/sales?view=barbers");
}
