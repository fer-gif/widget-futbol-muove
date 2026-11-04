// Tabla de goleadores de una liga, cargada a mano por los diarios y el super-admin
// (tabla `goleadores`, migración 006).
// Parámetro opcional: ?liga=<uuid de nuestra liga> (por defecto, Liga Necochea).
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { equiposDeLiga, resolverLiga } from "@/lib/ahorafutbol";

export const dynamic = "force-dynamic";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};

export async function GET(request: NextRequest) {
  try {
    const liga = await resolverLiga(request.nextUrl.searchParams.get("liga"));
    if (!liga.ligaId) throw new Error("No hay ligas cargadas");

    const [{ data, error }, equipos] = await Promise.all([
      supabase
        .from("goleadores")
        .select("nombre, equipo_id, goles")
        .eq("liga_id", liga.ligaId)
        .gt("goles", 0)
        .order("goles", { ascending: false })
        .order("nombre", { ascending: true }),
      equiposDeLiga(liga.ligaId),
    ]);
    if (error) throw error;

    const porId = new Map(equipos.map((e) => [e.id, e]));
    const goleadores = (data || []).map((g, i) => {
      const eq = g.equipo_id ? porId.get(g.equipo_id) : undefined;
      return {
        posicion: i + 1,
        nombre: g.nombre,
        equipo: eq?.nombre_equipo || "",
        logo: eq?.logo_url || "",
        goles: g.goles,
      };
    });

    return NextResponse.json(
      { success: true, total: goleadores.length, goleadores },
      { status: 200, headers }
    );
  } catch (err) {
    console.error("[goleadores]", err);
    return NextResponse.json(
      { success: false, error: "La tabla de goleadores no está disponible en este momento." },
      { status: 500, headers: { ...headers, "Cache-Control": "public, s-maxage=30" } }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers });
}
