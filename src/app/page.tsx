import type { Metadata } from "next";
import { Welcome } from "@/features/welcome/Welcome";

export const metadata: Metadata = { title: "Barbers.ph" };

export default function Page() {
  return <Welcome />;
}
