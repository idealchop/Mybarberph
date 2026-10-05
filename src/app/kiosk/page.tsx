import type { Metadata } from "next";
import { getServerRepository } from "@/data/server";
import { Kiosk } from "@/features/kiosk/Kiosk";
import { KioskGate } from "@/features/kiosk/KioskGate";

export const metadata: Metadata = { title: "Kiosk (POS 2)" };

export default async function KioskPage() {
  const repo = await getServerRepository();
  const [barbers, chairs, services, tickets, vouchers, shop] = await Promise.all([
    repo.listBarbers(), repo.listChairs(), repo.listServices(), repo.listTickets(), repo.listVouchers(), repo.getShop(),
  ]);
  return (
    <KioskGate>
      <Kiosk data={{
        barbers, chairs, services,
        waitingCount: tickets.filter((t) => t.status === "waiting").length,
        tickets, vouchers,
        shopName: shop.name,
      }} />
    </KioskGate>
  );
}
