import type { Metadata } from "next";
import { Gate } from "@/components/common/LockedFeature";
import { getRepository } from "@/data";
import { Vouchers } from "@/features/vouchers/Vouchers";

export const metadata: Metadata = { title: "Vouchers & referrals" };

export default async function VouchersPage() {
  const repo = getRepository();
  const [vouchers, referral, customers] = await Promise.all([repo.listVouchers(), repo.getReferralStats(), repo.listCustomers()]);
  return (
    <Gate feature="vouchers">
      <Vouchers data={{ vouchers, referral, customers }} />
    </Gate>
  );
}
