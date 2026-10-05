import { RequireAuth } from "@/components/auth/RequireAuth";
import { ShopShell } from "@/components/shell/ShopShell";
import { getServerRepository } from "@/data/server";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const repo = await getServerRepository();
  const [tickets, incoming] = await Promise.all([repo.listTickets(), repo.listIncomingBookings()]);
  const counts = {
    queue: tickets.filter((t) => t.status === "waiting").length,
    messages: 3,
    riverNew: incoming.filter((b) => b.status !== "declined" && b.status !== "verified").length - 1,
  };
  return (
    <RequireAuth>
      <ShopShell counts={counts}>{children}</ShopShell>
    </RequireAuth>
  );
}
