import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { TERMS } from "@/lib/legal";

export const metadata: Metadata = { title: "Terms of Service" };
export default function TermsPage() {
  return (
    <>
      <LegalPage doc={TERMS} />
      <p className="mx-auto max-w-[680px] px-5 pb-10 text-[12.5px] font-medium text-muted">
        Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap contributors</a>, available under the Open Database License. Place search by Photon (komoot).
      </p>
    </>
  );
}
