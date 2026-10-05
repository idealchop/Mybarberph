"use client";
import type { ReactNode } from "react";
import { Bell, LogIn, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, IconButton, SearchInput, Topbar } from "@river-apps/ui";
import { useAuthGateOptional } from "@/components/auth/AuthGateProvider";
import { signOut, useAuth } from "@/lib/firebase/auth-context";
import { ic } from "./nav";

/** Desktop page header: kit Topbar plus search, notifications, profile and sign out / sign in. */
export function PageHeader({ title, subtitle, search, searchWidth = 300 as 220 | 260 | 300, onSearch, actions, bell = true }: {
  title: ReactNode; subtitle: ReactNode; search?: string; searchWidth?: 220 | 260 | 300; onSearch?: (q: string) => void; actions?: ReactNode; bell?: boolean;
}) {
  const { user } = useAuth();
  const gate = useAuthGateOptional();
  const router = useRouter();
  const name = user?.displayName || user?.email || user?.phoneNumber || (user ? "Owner" : "Guest");

  async function logout() {
    await signOut();
    router.refresh();
  }

  return (
    <Topbar
      title={title}
      subtitle={subtitle}
      actions={<>
        {search ? <SearchInput className={`hidden xl:flex ${searchWidth === 260 ? "w-[260px]" : searchWidth === 220 ? "w-[220px]" : "w-[300px]"}`} placeholder={search} label={search} onChange={onSearch ? (e) => onSearch(e.target.value) : undefined} /> : null}
        {actions}
        {bell ? <IconButton variant="surface" label="Notifications" count={user ? 3 : undefined} icon={<Bell {...ic} />} /> : null}
        <Avatar name={name} preset={user ? "sky" : "peach"} size={44} />
        {user ? (
          <IconButton variant="surface" label="Sign out" icon={<LogOut {...ic} />} onClick={() => void logout()} />
        ) : (
          <IconButton
            variant="surface"
            label="Sign in"
            icon={<LogIn {...ic} />}
            onClick={() => gate?.openAuth(undefined, "Sign in to save changes and run your shop.")}
          />
        )}
      </>}
    />
  );
}
