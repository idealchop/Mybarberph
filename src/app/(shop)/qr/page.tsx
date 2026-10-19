import type { Metadata } from "next";
import { QrScreen } from "@/components/qr/qr-screen";

export const metadata: Metadata = { title: "QR code" };

export default function QrPage() {
  return <QrScreen />;
}
