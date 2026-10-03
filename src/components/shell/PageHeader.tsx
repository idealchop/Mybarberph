"use client";
import type { ReactNode } from "react";
import { Bell } from "lucide-react";
import { Avatar, IconButton, SampleDataTag, SearchInput, Topbar } from "@river-apps/ui";
import { ic } from "./nav";

/** Desktop page header: kit Topbar (variant "page") plus the shared search, notifications and profile. */
export function PageHeader({ title, subtitle, search, searchWidth = 300 as 220 | 260 | 300, onSearch, actions, bell = true }: {
  title: ReactNode; subtitle: ReactNode; search?: string; searchWidth?: 220 | 260 | 300; onSearch?: (q: string) => void; actions?: ReactNode; bell?: boolean;
}) {
  return (
    <Topbar
      title={title}
      subtitle={<>{subtitle} <SampleDataTag className="ml-1 align-middle" /></>}
      actions={<>
        {search ? <SearchInput className={`hidden xl:flex ${searchWidth === 260 ? "w-[260px]" : searchWidth === 220 ? "w-[220px]" : "w-[300px]"}`} placeholder={search} label={search} onChange={onSearch ? (e) => onSearch(e.target.value) : undefined} /> : null}
        {actions}
        {bell ? <IconButton variant="surface" label="Notifications" count={3} icon={<Bell {...ic} />} /> : null}
        <Avatar name="Jimboy" preset="sky" size={44} />
      </>}
    />
  );
}
