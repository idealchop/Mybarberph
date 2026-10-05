"use client";
import type { ReactNode } from "react";
import { Bell, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, IconButton, SampleDataTag, SearchInput, Topbar } from "@river-apps/ui";
import { signOut, useAuth } from "@/lib/firebase/auth-context";
import { ic } from "./nav";

/** Desktop page header: kit Topbar plus search, notifications, profile and sign out. */
export function PageHeader({ title, subtitle, search, searchWidth = 300 as 220 | 260 | 300, onSearch, actions, bell = true }: {
  title: ReactNode; subtitle: ReactNode; search?: string; searchWidth?: 220 | 260 | 300; onSearch?: (q: string) => void; actions?: ReactNode; bell?: boolean;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const name = user?.displayName || user?.email || user?.phoneNumber || "Owner";

  async function logout() {
    await signOut();
    router.replace("/");
  }

  return (
    <Topbar
      title={title}
      subtitle={<>{subtitle} <SampleDataTag className="ml-1 align-middle" /></>}
      actions={<>
        {search ? <SearchInput className={`hidden xl:flex ${searchWidth === 260 ? "w-[260px]" : searchWidth === 220 ? "w-[220px]" : "w-[300px]"}`} placeholder={search} label={search} onChange={onSearch ? (e) => onSearch(e.target.value) : undefined} /> : null}
        {actions}
        {bell ? <IconButton variant="surface" label="Notifications" count={3} icon={<Bell {...ic} />} /> : null}
        <Avatar name={name} preset="sky" size={44} />
        <IconButton variant="surface" label="Sign out" icon={<LogOut {...ic} />} onClick={() => void logout()} />
      </>}
    />
  );
}
