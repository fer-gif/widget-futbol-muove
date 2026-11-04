import { getSession } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";
import Toaster from "@/components/Toaster";

export const dynamic = "force-dynamic";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session?.role !== "superadmin") {
    return <LoginForm role="superadmin" />;
  }
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
