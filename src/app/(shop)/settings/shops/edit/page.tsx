import type { Metadata } from "next";
import { Suspense } from "react";
import { ManageShopScreen } from "@/features/settings/ManageShopScreen";

export const metadata: Metadata = { title: "Manage Shop" };

export default function ManageShopPage() {
  return <Suspense><ManageShopScreen /></Suspense>;
}
