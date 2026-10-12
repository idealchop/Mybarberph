import type { Metadata } from "next";
import { Suspense } from "react";
import { FindTicket } from "@/features/scan/FindTicket";

export const metadata: Metadata = { title: "Scan QR" };

export default function ScanPage() {
  return (
    <Suspense fallback={null}>
      <FindTicket />
    </Suspense>
  );
}
