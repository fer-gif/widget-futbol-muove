// Métricas del widget para los paneles. Super-admin: cualquier medio o todos.
// Periodista: solo su medio.
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fechaArgentina(offsetDias: number): string {
  const d = new Date(Date.now() - offsetDias * 864e5);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(d);
}

export async function GET(req: NextRequest) {
  const auth = await requireRole(["superadmin", "periodista"]);
  if (auth.error) return auth.error;

  const params = req.nextUrl.searchParams;
  const dias = Math.min(Math.max(Number(params.get("dias")) || 30, 1), 365);
  let clienteId = params.get("cliente");
  if (auth.session.role === "periodista") clienteId = auth.session.clienteId;
  if (clienteId && !UUID.test(clienteId)) clienteId = null;

  const desde = fechaArgentina(dias - 1);
  const hasta = fechaArgentina(0);

  let q = supabase
    .from("widget_metricas")
    .select("cliente_id, fecha, impresiones, clics_sponsor, clics_prode, interacciones")
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("fecha", { ascending: true });
  if (clienteId) q = q.eq("cliente_id", clienteId);

  const { data, error } = await q;
  if (error) {
    const sinTabla = /widget_metricas|does not exist|schema cache/i.test(error.message);
    return NextResponse.json(
      {
        success: false,
        error: sinTabla
          ? "Las métricas todavía no están activadas: falta correr la migración 005_metricas.sql."
          : error.message,
      },
      { status: sinTabla ? 503 : 500 }
    );
  }

  return NextResponse.json({ success: true, desde, hasta, dias, filas: data || [] });
}
