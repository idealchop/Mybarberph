import { ShopShell } from "@/components/shell/ShopShell";
import { getRepository } from "@/data";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const repo = getRepository();
  const [tickets, incoming] = await Promise.all([repo.listTickets(), repo.listIncomingBookings()]);
  const counts = {
    queue: tickets.filter((t) => t.status === "waiting").length,
    messages: 3,
    riverNew: incoming.filter((b) => b.status !== "declined" && b.status !== "verified").length - 1,
  };
  return <ShopShell counts={counts}>{children}</ShopShell>;
}
