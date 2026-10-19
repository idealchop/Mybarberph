import type { Metadata } from "next";
import { Suspense } from "react";
import { QueueBoard } from "@/features/queue";

export const metadata: Metadata = { title: "Queue" };

export default function QueuePage() {
  return (
    <Suspense fallback={null}>
      <QueueBoard />
    </Suspense>
  );
}
