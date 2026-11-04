import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase-server";
import LoginForm from "@/components/LoginForm";
import Toaster from "@/components/Toaster";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session?.role === "periodista" || session?.role === "superadmin") {
    return (
      <>
        {children}
        <Toaster />
      </>
    );
  }

  const { data: clientes } = await supabase
    .from("clientes")
    .select("id, nombre_medio")
    .neq("estado", "inactivo")
    .order("nombre_medio");

  return <LoginForm role="periodista" clientes={clientes || []} />;
}
