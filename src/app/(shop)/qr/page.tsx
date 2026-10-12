import type { Metadata } from "next";
import { QrScreen } from "@/components/qr/QrScreen";

export const metadata: Metadata = { title: "QR code" };

export default function QrPage() {
  return <QrScreen />;
}
