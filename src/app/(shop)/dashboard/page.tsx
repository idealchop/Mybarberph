import type { Metadata } from "next";
import { Gate } from "@/components/common/LockedFeature";
import { getRepository } from "@/data";
import { Dashboard } from "@/features/dashboard/Dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const repo = getRepository();
  const [summary, d7, d14, d30, tickets, chairs, barbers, stats, insights, vouchers, referral] = await Promise.all([
    repo.getSalesSummary(), repo.listDailySales(7), repo.listDailySales(14), repo.listDailySales(30), repo.listTickets(),
    repo.listChairs(), repo.listBarbers(), repo.getBarberStatsToday(), repo.listInsights(), repo.listVouchers(), repo.getReferralStats(),
  ]);
  return (
    <Gate feature="dashboard">
      <Dashboard data={{ summary, sales: { 7: d7, 14: d14, 30: d30 }, tickets, chairs, barbers, stats, insights, vouchers, referral }} />
    </Gate>
  );
}
