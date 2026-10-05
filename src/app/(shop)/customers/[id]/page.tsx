import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Gate } from "@/components/common/LockedFeature";
import { getServerRepository } from "@/data/server";
import { CustomerDetail } from "@/features/customers/CustomerDetail";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const c = await (await getServerRepository()).getCustomer((await params).id);
  return { title: c ? c.name : "Customer" };
}

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = await getServerRepository();
  const [customer, visits, barbers, plans, memberships, vouchers] = await Promise.all([
    repo.getCustomer(id), repo.listCustomerVisits(id), repo.listBarbers(), repo.listMembershipPlans(), repo.listMemberships(), repo.listVouchers(),
  ]);
  if (!customer) notFound();
  return (
    <Gate feature="customers">
      <CustomerDetail data={{ customer, visits, barbers, plans, membership: memberships.find((m) => m.id === customer.membershipId), vouchers }} />
    </Gate>
  );
}
