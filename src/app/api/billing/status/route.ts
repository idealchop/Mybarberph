import { json } from "@/lib/server/auth";
import { hasPaymongo } from "@/lib/server/paymongo";

export const dynamic = "force-dynamic";
export function GET() {
  return json({ paymongo: hasPaymongo() });
}
