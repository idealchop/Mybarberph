import type { Metadata } from "next";
import { EditShopScreen } from "@/features/settings/EditShopScreen";

export const metadata: Metadata = { title: "Edit shop" };

export default function EditShopPage() {
  return <EditShopScreen />;
}
