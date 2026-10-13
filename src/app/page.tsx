import { redirect } from "next/navigation";

/** The app opens straight on Home; guests can browse without an account. */
export default function Page() {
  redirect("/home");
}
