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

    // 0. Recalcular puntos dinámicos en base a partidos finalizados
    const { data: finishedMatches } = await supabase
      .from("partidos")
      .select("id, goles_local, goles_visitante")
      .eq("estado_partido", "finalizado");

    const finishedMap = new Map<string, { local: number; visitante: number }>();
    (finishedMatches || []).forEach((m) => {
      if (m.goles_local !== null && m.goles_visitante !== null) {
        finishedMap.set(m.id, { local: Number(m.goles_local), visitante: Number(m.goles_visitante) });
      }
    });

    const finishedMatchIds = Array.from(finishedMap.keys());
    const userPointsMap = new Map<string, number>();

    if (finishedMatchIds.length > 0) {
      const { data: allPredictions } = await supabase
        .from("prode_pronosticos")
        .select("participante_id, partido_id, goles_local_pred, goles_visitante_pred")
        .in("partido_id", finishedMatchIds);

      (allPredictions || []).forEach((p) => {
        const real = finishedMap.get(p.partido_id);
        if (!real) return;

        const pL = Number(p.goles_local_pred ?? 0);
        const pV = Number(p.goles_visitante_pred ?? 0);
        const rL = real.local;
        const rV = real.visitante;

        let pts = 0;
        if (pL === rL && pV === rV) {
          pts = 3;
        } else {
          const pDiff = pL - pV;
          const rDiff = rL - rV;
          if ((pDiff > 0 && rDiff > 0) || (pDiff < 0 && rDiff < 0) || (pDiff === 0 && rDiff === 0)) {
            pts = 1;
          }
        }

        const currentPts = userPointsMap.get(p.participante_id) || 0;
        userPointsMap.set(p.participante_id, currentPts + pts);
      });

      // Actualizar la tabla prode_participantes en la base de datos Supabase para sincronizar
      for (const [pId, pts] of userPointsMap.entries()) {
        await supabase.from("prode_participantes").update({ puntos_totales: pts }).eq("id", pId);
      }
    }

    let ranking: any[] = [];

    // 1. Ranking de Liga Privada de Amigos
    if (ligaPrivadaId) {
      const { data: miembros, error: errMiembros } = await supabase
        .from("prode_miembros_liga")
        .select("participante_id, prode_participantes!inner(id, nombre, racha_actual)")
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
        puntos_totales: userPointsMap.get(m.prode_participantes.id) || 0,
        racha_actual: m.prode_participantes.racha_actual || 0,
      }));

      // Ordenar por puntos_totales descendente
      ranking.sort((a, b) => b.puntos_totales - a.puntos_totales);
    } else {
      // 2. Ranking General del Diario
      const { data: general, error: errGeneral } = await supabase
        .from("prode_participantes")
        .select("id, nombre, racha_actual")
        .eq("cliente_id", clientId);

      if (errGeneral) {
        console.error("Error al consultar ranking general:", errGeneral);
        return NextResponse.json(
          { success: false, error: "Error al obtener la tabla de posiciones" },
          { status: 500, headers }
        );
      }

      ranking = (general || []).map((g: any) => ({
        id: g.id,
        nombre: g.nombre,
        puntos_totales: userPointsMap.get(g.id) || 0,
        racha_actual: g.racha_actual || 0,
      }));

      ranking.sort((a, b) => b.puntos_totales - a.puntos_totales);
      ranking = ranking.slice(0, 100);
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
