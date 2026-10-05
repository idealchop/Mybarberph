import type { Metadata } from "next";
import { Gate } from "@/components/common/LockedFeature";
import { getServerRepository } from "@/data/server";
import { Customers } from "@/features/customers/Customers";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage() {
  const repo = await getServerRepository();
  const [customers, barbers, plans, memberships] = await Promise.all([repo.listCustomers(), repo.listBarbers(), repo.listMembershipPlans(), repo.listMemberships()]);
  return (
    <Gate feature="customers">
      <Customers data={{ customers, barbers, plans, memberships }} />
    </Gate>
  );
}
