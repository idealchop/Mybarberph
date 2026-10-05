import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/AuthForm";

export const metadata: Metadata = { title: "Create your shop" };

export default function SignupPage() {
  return <AuthForm mode="signup" />;
}
