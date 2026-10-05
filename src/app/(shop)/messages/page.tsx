import type { Metadata } from "next";
import { Gate } from "@/components/common/LockedFeature";
import { getServerRepository } from "@/data/server";
import { Messages } from "@/features/messages/Messages";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  const repo = await getServerRepository();
  const [templates, log] = await Promise.all([repo.listMessageTemplates(), repo.listMessageLog()]);
  return (
    <Gate feature="messages">
      <Messages data={{ templates, log }} />
    </Gate>
  );
}
