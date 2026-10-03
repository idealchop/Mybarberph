import type { Metadata } from "next";
import { Gate } from "@/components/common/LockedFeature";
import { getRepository } from "@/data";
import { Queue } from "@/features/queue/Queue";

export const metadata: Metadata = { title: "Queue & schedule" };

export default async function QueuePage() {
  const repo = getRepository();
  const [tickets, chairs, barbers, services, incoming, waitlist] = await Promise.all([
    repo.listTickets(), repo.listChairs(), repo.listBarbers(), repo.listServices(), repo.listIncomingBookings(), repo.listWaitlist(),
  ]);
  return (
    <Gate feature="queue">
      <Queue data={{ tickets, chairs, barbers, services, incoming, waitlist }} />
    </Gate>
  );
}
