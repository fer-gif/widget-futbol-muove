import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import {
  BLOCKED_MESSAGE,
  SESSION_COOKIE,
  clearFailures,
  createSessionToken,
  hashSecret,
  isBlocked,
  registerFailure,
  safeEqual,
  sessionCookieOptions,
  verifyHashedSecret,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

function clientIp(req: NextRequest): string {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
}

function fail(message: string, status = 401) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(req: NextRequest) {
  let body: { role?: string; password?: string; clienteId?: string };
  try {
    body = await req.json();
  } catch {
    return fail("Solicitud inválida", 400);
  }

  const password = String(body.password || "");
  if (!password) return fail("Ingresá la clave.", 400);
  const ip = clientIp(req);

  try {
    // --- SUPER-ADMIN ---------------------------------------------------------
    if (body.role === "superadmin") {
      const expected = process.env.SUPER_ADMIN_PASSWORD;
      if (!expected) return fail("SUPER_ADMIN_PASSWORD no está configurada en el servidor.", 500);

      const key = `sa:${ip}`;
      if (await isBlocked(key)) return fail(BLOCKED_MESSAGE, 429);

      if (!safeEqual(password, expected)) {
        await registerFailure(key);
        return fail("Clave incorrecta.");
      }
      await clearFailures(key);
      await migrateLegacyClaves();
      return withSession({ role: "superadmin", clienteId: null, nombre: "Super Admin" });
    }

    // --- PERIODISTA ----------------------------------------------------------
    if (body.role === "periodista") {
      const clienteId = String(body.clienteId || "");
      if (!clienteId) return fail("Seleccioná tu medio.", 400);

      const key = `p:${clienteId}:${ip}`;
      if (await isBlocked(key)) return fail(BLOCKED_MESSAGE, 429);

      const { data: cliente } = await supabase
        .from("clientes")
        .select("*")
        .eq("id", clienteId)
        .maybeSingle();

      if (!cliente) return fail("Medio no encontrado.", 404);

      let ok = false;
      if (cliente.clave_hash) {
        ok = verifyHashedSecret(password, cliente.clave_hash);
      } else if (cliente.clave_periodista) {
        // Clave heredada en texto plano: se valida y se migra a hash al instante.
        ok = safeEqual(password, String(cliente.clave_periodista));
        if (ok) {
          const clave_hash = hashSecret(password);
          const { error } = await supabase
            .from("clientes")
            .update({ clave_hash, clave_periodista: null })
            .eq("id", clienteId);
          if (error) {
            // clave_periodista todavía es NOT NULL: guardamos solo el hash.
            await supabase.from("clientes").update({ clave_hash }).eq("id", clienteId);
          }
        }
      }

      if (!ok) {
        await registerFailure(key);
        return fail("Clave incorrecta. Verificá e intentá de nuevo.");
      }
      if (cliente.estado === "inactivo") {
        return fail("La suscripción de este medio está inactiva.", 403);
      }

      await clearFailures(key);
      return withSession({ role: "periodista", clienteId: cliente.id, nombre: cliente.nombre_medio });
    }

    return fail("Rol inválido", 400);
  } catch (err) {
    console.error("[auth/login]", err);
    return fail(err instanceof Error ? err.message : "Error del servidor", 500);
  }
}

/** Convierte a hash las claves de periodista que siguen en texto plano (idempotente). */
async function migrateLegacyClaves() {
  try {
    const { data, error } = await supabase
      .from("clientes")
      .select("id, clave_periodista")
      .not("clave_periodista", "is", null);
    if (error || !data) return;
    for (const c of data) {
      const plain = String(c.clave_periodista || "").trim();
      if (!plain) continue;
      await supabase
        .from("clientes")
        .update({ clave_hash: hashSecret(plain), clave_periodista: null })
        .eq("id", c.id);
    }
  } catch (err) {
    console.error("[auth/login] migración de claves", err);
  }
}

function withSession(s: { role: "superadmin" | "periodista"; clienteId: string | null; nombre: string }) {
  const res = NextResponse.json({ success: true, session: s });
  res.cookies.set(SESSION_COOKIE, createSessionToken(s), sessionCookieOptions());
  return res;
}
