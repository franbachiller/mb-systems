import { redirect } from "next/navigation";
import AdminLoginForm from "@/components/admin-login-form";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  if (await isAdminAuthenticated()) {
    redirect(sanitizeNextPath(next));
  }

  return <AdminLoginForm nextPath={sanitizeNextPath(next)} />;
}

function sanitizeNextPath(value: string | undefined) {
  if (
    value?.startsWith("/admin") &&
    !value.startsWith("/admin/login") &&
    !value.startsWith("//")
  ) {
    return value;
  }

  return "/admin";
}
