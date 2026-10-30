import { redirect } from "next/navigation";

/** Performance now lives on Sales → Performance. */
export default async function PerformancePage({ searchParams }: { searchParams: Promise<{ loc?: string }> }) {
  const { loc } = await searchParams;
  redirect(`/sales?view=services${loc ? `&loc=${encodeURIComponent(loc)}` : ""}`);
}
