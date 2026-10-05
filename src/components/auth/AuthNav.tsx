"use client";

import { IconButton } from "@river-apps/ui";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function AuthNav({ back }: { back: string }) {
  const router = useRouter();
  return (
    <div className="flex h-14 flex-none items-center justify-between px-5">
      <IconButton label="Back" icon={<ChevronLeft size={22} strokeWidth={1.75} />} onClick={() => router.push(back)} />
      <span className="text-[15px] font-bold">Sign in</span>
      <span className="w-11" />
    </div>
  );
}
