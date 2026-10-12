import { ShopShell } from "@/components/shell/ShopShell";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <ShopShell>{children}</ShopShell>;
}
