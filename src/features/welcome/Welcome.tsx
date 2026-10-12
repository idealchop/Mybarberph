"use client";

import { Button, FloatingCard } from "@river-apps/ui";
import { useRouter } from "next/navigation";
import { BarberChair } from "@/components/art";
import { Brand } from "@/components/shell/Brand";

/** Entry. The shop itself is Home, Queue, and Community. */
export function Welcome() {
  const router = useRouter();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col bg-canvas">
      <div className="px-6 pt-4"><Brand /></div>
      <div className="relative mx-4 mt-5 h-[280px] overflow-hidden rounded-[32px] bg-grey-100">
        <div className="absolute inset-x-0 bottom-2 flex justify-center"><BarberChair size={220} /></div>
        <FloatingCard className="absolute left-4 top-5" title="Chair 2" subtitle="In chair" />
        <FloatingCard className="absolute right-4 top-16" title="New booking" subtitle="Skin fade · 7:00 PM" />
      </div>
      <div className="px-7 pt-7">
        <h1 className="text-[31px] font-extrabold leading-[1.12] tracking-[-0.03em]">Run your shop<br />from your phone</h1>
        <p className="mt-2.5 text-[16px] font-medium text-muted">Queue, bookings and today’s sales in one simple app.</p>
      </div>
      <div className="mt-auto px-6 pb-10 pt-6">
        <Button fullWidth onClick={() => router.push("/home")}>Open the shop</Button>
      </div>
    </main>
  );
}
