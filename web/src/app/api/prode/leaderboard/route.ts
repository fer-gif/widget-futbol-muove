import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("client-id");
    const ligaPrivadaId = searchParams.get("liga-privada-id");
    const participanteId = searchParams.get("participante-id");

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: "client-id es requerido" },
        { status: 400, headers }
      );
    }

    let ranking: any[] = [];

    // 1. Ranking de Liga Privada de Amigos
    if (ligaPrivadaId) {
      const { data: miembros, error: errMiembros } = await supabase
        .from("prode_miembros_liga")
        .select("participante_id, prode_participantes!inner(id, nombre, puntos_totales, racha_actual)")
        .eq("liga_privada_id", ligaPrivadaId);

      if (errMiembros) {
        console.error("Error al consultar ranking de liga privada:", errMiembros);
        return NextResponse.json(
          { success: false, error: "Error al consultar la liga de amigos" },
          { status: 500, headers }
        );
      }

      ranking = (miembros || []).map((m: any) => ({
        id: m.prode_participantes.id,
        nombre: m.prode_participantes.nombre,
        puntos_totales: m.prode_participantes.puntos_totales,
        racha_actual: m.prode_participantes.racha_actual,
      }));

      // Ordenar por puntos_totales descendente
      ranking.sort((a, b) => b.puntos_totales - a.puntos_totales);
    } else {
      // 2. Ranking General del Diario (Top 100)
      const { data: general, error: errGeneral } = await supabase
        .from("prode_participantes")
        .select("id, nombre, puntos_totales, racha_actual")
        .eq("cliente_id", clientId)
        .order("puntos_totales", { ascending: false })
        .limit(100);

      if (errGeneral) {
        console.error("Error al consultar ranking general:", errGeneral);
        return NextResponse.json(
          { success: false, error: "Error al obtener la tabla de posiciones" },
          { status: 500, headers }
        );
      }

      ranking = general || [];
    }

    // Mapear posiciones (Rank #1, #2, #3...)
    const rankingConPosiciones = ranking.map((item, index) => ({
      posicion: index + 1,
      ...item,
      es_usuario_actual: participanteId ? item.id === participanteId : false,
    }));

    // Encontrar la posición del usuario actual si no está en el top de la lista
    let miPosicion = null;
    if (participanteId) {
      miPosicion = rankingConPosiciones.find(r => r.id === participanteId) || null;
    }

    return NextResponse.json(
      {
        success: true,
        ranking: rankingConPosiciones,
        mi_posicion: miPosicion,
      },
      { status: 200, headers }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500, headers }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers });
}
