import type { Metadata } from "next";
import { GuestBrowseBanner } from "@/components/auth/GuestBrowseBanner";
import { getServerRepository, isGuestSession } from "@/data/server";
import { PartnerShell } from "@/features/partner/PartnerShell";
import { SyncShopTier } from "@/lib/tier";

export const metadata: Metadata = { title: { default: "Partner app", template: "%s · Barbers.ph Partner" } };

/** Partner phone app — guests can browse demo data; mutations open the auth gate. */
export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const repo = await getServerRepository();
  const guest = await isGuestSession();
  const [incoming, visits, notifications, barbers, shop] = await Promise.all([
    repo.listIncomingBookings(), repo.listVerifiedVisits(), repo.listPartnerNotifications(), repo.listBarbers(), repo.getShop(),
  ]);
  return (
    <>
      <SyncShopTier tier={shop.tier} />
      {guest ? <GuestBrowseBanner compact /> : null}
      <PartnerShell initial={{ incoming, visits, notifications, barbers, shop }}>{children}</PartnerShell>
    </>
  );
}
