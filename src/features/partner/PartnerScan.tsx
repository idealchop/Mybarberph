"use client";
import { useRouter } from "next/navigation";
import { ScanVerify } from "@/features/scan/ScanVerify";
import { usePartner } from "./PartnerShell";
import { PageTitle } from "./parts";

export function PartnerScan() {
  const { barbers, addVisit } = usePartner();
  const router = useRouter();
  return (
    <>
      <PageTitle title="Scan to verify" subtitle="Ask for their River Mobile QR" />
      <div className="mx-4 mt-3 rounded-card bg-surface p-4 shadow-card">
        <ScanVerify tone="phone" barberLabel={(id) => barbers.find((b) => b.id === id)?.nickname} onVerified={addVisit} onDone={() => router.push("/partner")} />
      </div>
      <p className="px-6 pt-4 text-center text-[12.5px] font-medium text-muted">Camera preview is simulated in this demo. Verification is done by River Mobile’s Partner API.</p>
    </>
  );
}
