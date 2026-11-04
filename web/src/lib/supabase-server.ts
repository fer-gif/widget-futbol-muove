// Cliente Supabase EXCLUSIVO DEL SERVIDOR (API routes / Server Components).
// Usa la service role key, que saltea RLS. Nunca importar desde un componente "use client".
import { createClient } from "@supabase/supabase-js";

if (typeof window !== "undefined") {
  throw new Error("supabase-server no puede usarse en el navegador.");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!serviceRoleKey) {
  // Transición: sin service role key se usa la anon key. Cuando se aplique
  // database/migrations/002_lockdown_rls.sql esto deja de funcionar, así que
  // la variable es obligatoria en producción.
  console.error(
    "[supabase-server] Falta SUPABASE_SERVICE_ROLE_KEY. Usando anon key como respaldo temporal."
  );
}

export const supabase = createClient(
  supabaseUrl,
  serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  { auth: { persistSession: false, autoRefreshToken: false } }
);
