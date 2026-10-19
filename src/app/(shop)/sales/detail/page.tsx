import type { Metadata } from "next";
import { Suspense } from "react";
import { SalesDetailScreen } from "@/features/sales";
export const metadata: Metadata = { title: "Sales detail" };
export default function Page() { return <Suspense><SalesDetailScreen /></Suspense>; }
