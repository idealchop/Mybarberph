import { RequireAuth } from "@/components/auth/RequireAuth";
import type { Metadata } from "next";
import { getServerRepository } from "@/data/server";
import { PartnerShell } from "@/features/partner/PartnerShell";

export const metadata: Metadata = { title: { default: "Partner app", template: "%s · Barbers.ph Partner" } };

/** Partner phone app (free tier). State lives in PartnerShell so it survives tab changes. */
export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const repo = await getServerRepository();
  const [incoming, visits, notifications, barbers, shop] = await Promise.all([
    repo.listIncomingBookings(), repo.listVerifiedVisits(), repo.listPartnerNotifications(), repo.listBarbers(), repo.getShop(),
  ]);
  return (
    <RequireAuth>
      <PartnerShell initial={{ incoming, visits, notifications, barbers, shop }}>{children}</PartnerShell>
    </RequireAuth>
  );
}
