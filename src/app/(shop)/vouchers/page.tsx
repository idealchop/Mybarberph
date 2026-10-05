import type { Metadata } from "next";
import { Gate } from "@/components/common/LockedFeature";
import { getServerRepository } from "@/data/server";
import { Vouchers } from "@/features/vouchers/Vouchers";

export const metadata: Metadata = { title: "Vouchers & referrals" };

export default async function VouchersPage() {
  const repo = await getServerRepository();
  const [vouchers, referral, customers] = await Promise.all([repo.listVouchers(), repo.getReferralStats(), repo.listCustomers()]);
  return (
    <Gate feature="vouchers">
      <Vouchers data={{ vouchers, referral, customers }} />
    </Gate>
  );
}
