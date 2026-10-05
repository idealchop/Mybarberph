import { RequireAuth } from "@/components/auth/RequireAuth";
import { ShopShell } from "@/components/shell/ShopShell";
import { getServerRepository } from "@/data/server";
import { SyncShopTier } from "@/lib/tier";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const repo = await getServerRepository();
  const [tickets, incoming, shop, log] = await Promise.all([
    repo.listTickets(),
    repo.listIncomingBookings(),
    repo.getShop(),
    repo.listMessageLog(),
  ]);
  const counts = {
    queue: tickets.filter((t) => t.status === "waiting" || t.status === "in_service").length,
    messages: log.filter((m) => m.status === "failed" || m.status === "sent").length,
    riverNew: incoming.filter((b) => b.status === "pending" || b.status === "accepted").length,
  };
  return (
    <RequireAuth>
      <SyncShopTier tier={shop.tier} />
      <ShopShell counts={counts}>{children}</ShopShell>
    </RequireAuth>
  );
}
