// Gestión de participantes del Prode (solo paneles autenticados).
// Super-admin ve todos los medios; un periodista solo los de su medio.
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { hashSecret, requireRole, type Session } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Devuelve el cliente_id al que la sesión puede acceder (null = todos, solo super-admin). */
function scopeFor(session: Session, requested: string | null): string | null {
  if (session.role === "periodista") return session.clienteId;
  return requested && requested !== "todos" ? requested : null;
}

async function canTouchParticipant(session: Session, id: string): Promise<boolean> {
  if (session.role === "superadmin") return true;
  const { data } = await supabase.from("prode_participantes").select("cliente_id").eq("id", id).maybeSingle();
  return Boolean(data && data.cliente_id === session.clienteId);
}

export async function GET(request: NextRequest) {
  const auth = await requireRole(["superadmin", "periodista"]);
  if (auth.error) return auth.error;

  try {
    const clientId = scopeFor(auth.session, request.nextUrl.searchParams.get("client-id"));

    let query = supabase
      .from("prode_participantes")
      .select("id, nombre, email, puntos_totales, racha_actual, cliente_id, created_at, clientes(nombre_medio)");
    if (clientId) query = query.eq("cliente_id", clientId);

    const { data: participantes, error } = await query.order("created_at", { ascending: false });
    if (error) {
      console.error("Error al obtener participantes del Prode:", error);
      return NextResponse.json({ success: false, error: "Error al consultar la base de datos" }, { status: 500 });
    }

    const ids = (participantes || []).map((p) => p.id);
    const counts = new Map<string, number>();
    if (ids.length > 0) {
      const { data: pronosticos } = await supabase
        .from("prode_pronosticos")
        .select("participante_id")
        .in("participante_id", ids);
      (pronosticos || []).forEach((p) => counts.set(p.participante_id, (counts.get(p.participante_id) || 0) + 1));
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resultado = (participantes || []).map((p: any) => ({
      id: p.id,
      nombre: p.nombre,
      email: p.email,
      puntos_totales: p.puntos_totales || 0,
      racha_actual: p.racha_actual || 0,
      cliente_id: p.cliente_id,
      nombre_medio: p.clientes?.nombre_medio || "General / Muove",
      created_at: p.created_at,
      total_pronosticos: counts.get(p.id) || 0,
    }));

    return NextResponse.json({ success: true, count: resultado.length, participantes: resultado });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

/** Asignar un PIN nuevo a un participante (reemplaza el "olvidé mi PIN" público). */
export async function PATCH(request: NextRequest) {
  const auth = await requireRole(["superadmin", "periodista"]);
  if (auth.error) return auth.error;

  try {
    const { id, pin } = await request.json();
    if (!id || !/^\d{4}$/.test(String(pin || "").trim())) {
      return NextResponse.json({ success: false, error: "Se requiere id y un PIN de 4 dígitos" }, { status: 400 });
    }
    if (!(await canTouchParticipant(auth.session, id))) {
      return NextResponse.json({ success: false, error: "Sin permisos sobre este participante" }, { status: 403 });
    }

    const { error } = await supabase
      .from("prode_participantes")
      .update({ pin_hash: hashSecret(String(pin)) })
      .eq("id", id);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireRole(["superadmin", "periodista"]);
  if (auth.error) return auth.error;

  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "ID de participante es requerido" }, { status: 400 });
    }
    if (!(await canTouchParticipant(auth.session, id))) {
      return NextResponse.json({ success: false, error: "Sin permisos sobre este participante" }, { status: 403 });
    }

    const { error } = await supabase.from("prode_participantes").delete().eq("id", id);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, message: "Participante eliminado correctamente" });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
