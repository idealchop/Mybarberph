import type { Metadata } from "next";
import { Suspense } from "react";
import { BookScreen } from "@/components/qr/BookScreen";

export const metadata: Metadata = { title: "Book a haircut" };

/** Public page opened by the shop's booking QR. */
export default function BookPage() {
  return (
    <Suspense fallback={null}>
      <BookScreen />
    </Suspense>
  );
}
