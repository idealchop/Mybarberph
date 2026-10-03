import type { Metadata } from "next";
import { Gate } from "@/components/common/LockedFeature";
import { getRepository } from "@/data";
import { SalesRecord } from "@/features/sales/SalesRecord";

export const metadata: Metadata = { title: "Sales record" };

export default async function SalesPage() {
  const repo = getRepository();
  const [summary, page, barbers, chairs, d7, d30] = await Promise.all([
    repo.getSalesSummary(), repo.listTransactions({ pageSize: 500 }), repo.listBarbers(), repo.listChairs(), repo.listDailySales(7), repo.listDailySales(30),
  ]);
  return (
    <Gate feature="sales">
      <SalesRecord data={{ summary, transactions: page.items, barbers, chairs, week: d7, month: d30 }} />
    </Gate>
  );
}
