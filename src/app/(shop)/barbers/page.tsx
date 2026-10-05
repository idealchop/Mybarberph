import type { Metadata } from "next";
import { Gate } from "@/components/common/LockedFeature";
import { getServerRepository } from "@/data/server";
import { BarbersSetup } from "@/features/barbers/BarbersSetup";

export const metadata: Metadata = { title: "Barbers & chairs" };

export default async function BarbersPage() {
  const repo = await getServerRepository();
  const [barbers, chairs, services, styles, stats] = await Promise.all([repo.listBarbers(), repo.listChairs(), repo.listServices(), repo.listHaircutStyles(), repo.getBarberStatsToday()]);
  return (
    <Gate feature="barbers">
      <BarbersSetup data={{ barbers, chairs, services, styles, stats }} />
    </Gate>
  );
}
