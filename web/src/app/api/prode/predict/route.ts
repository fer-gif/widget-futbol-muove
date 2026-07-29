import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// GET: Obtener pronósticos de un participante
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const participanteId = searchParams.get("participante-id");
    const ligaId = searchParams.get("liga-id");

    if (!participanteId) {
      return NextResponse.json(
        { success: false, error: "participante-id es requerido" },
        { status: 400, headers }
      );
    }

    // Consultar pronósticos cargados
    let query = supabase
      .from("prode_pronosticos")
      .select("*, partidos!inner(id, jornada, estado_partido, fecha_hora, liga_id)")
      .eq("participante_id", participanteId);

    if (ligaId) {
      query = query.eq("partidos.liga_id", ligaId);
    }

    const { data: pronosticos, error } = await query;

    if (error) {
      console.error("Error al consultar pronósticos:", error);
      return NextResponse.json(
        { success: false, error: "Error al obtener pronósticos" },
        { status: 500, headers }
      );
    }

    // Calcular puntos totales del participante en partidos finalizados
    let puntosTotales = 0;
    (pronosticos || []).forEach((p: any) => {
      const match = p.partidos;
      if (match && match.estado_partido === "finalizado" && match.goles_local !== null && match.goles_visitante !== null) {
        const pL = Number(p.goles_local_pred ?? 0);
        const pV = Number(p.goles_visitante_pred ?? 0);
        const rL = Number(match.goles_local);
        const rV = Number(match.goles_visitante);

        if (pL === rL && pV === rV) {
          puntosTotales += 3;
        } else {
          const pDiff = pL - pV;
          const rDiff = rL - rV;
          if ((pDiff > 0 && rDiff > 0) || (pDiff < 0 && rDiff < 0) || (pDiff === 0 && rDiff === 0)) {
            puntosTotales += 1;
          }
        }
      }
    });

    return NextResponse.json(
      { success: true, pronosticos: pronosticos || [], puntosTotales },
      { status: 200, headers }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500, headers }
    );
  }
}

// POST: Cargar o actualizar pronósticos (Guardado masivo por fecha)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { participanteId, predictions } = body; 
    // predictions: Array de { partidoId: string, golesLocal: number, golesVisitante: number }

    if (!participanteId || !Array.isArray(predictions) || predictions.length === 0) {
      return NextResponse.json(
        { success: false, error: "Faltan participanteId o la lista de pronósticos" },
        { status: 400, headers }
      );
    }

    // 1. Validar que el participante exista
    const { data: usuario, error: errUser } = await supabase
      .from("prode_participantes")
      .select("id")
      .eq("id", participanteId)
      .single();

    if (errUser || !usuario) {
      return NextResponse.json(
        { success: false, error: "Participante no encontrado" },
        { status: 404, headers }
      );
    }

    const matchIds = predictions.map(p => p.partidoId);

    // 2. Consultar el estado y horario de los partidos involucrados para validar la regla de Cierre por Fecha
    const { data: partidosInfo, error: errPartidos } = await supabase
      .from("partidos")
      .select("id, jornada, estado_partido, fecha_hora, liga_id")
      .in("id", matchIds);

    if (errPartidos || !partidosInfo || partidosInfo.length === 0) {
      return NextResponse.json(
        { success: false, error: "Partidos no encontrados" },
        { status: 404, headers }
      );
    }

    const now = new Date();

    // 2. Filtrar únicamente los partidos que estén ABIERTOS para pronosticar (programados y en horario futuro)
    const openMatchMap = new Map<string, boolean>();
    partidosInfo.forEach(p => {
      const matchDate = p.fecha_hora ? new Date(p.fecha_hora) : null;
      const estaCerrado = p.estado_partido !== "programado" || (matchDate && !isNaN(matchDate.getTime()) && now >= matchDate);
      openMatchMap.set(p.id, !estaCerrado);
    });

    const validPredictions = predictions.filter(p => openMatchMap.get(p.partidoId) === true);

    if (validPredictions.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          closed: true,
          error: "Los partidos seleccionados ya han comenzado y sus pronósticos están cerrados." 
        },
        { status: 403, headers }
      );
    }

    // 3. Upsert de los pronósticos de los partidos abiertos
    const rowsToUpsert = validPredictions.map(p => ({
      participante_id: participanteId,
      partido_id: p.partidoId,
      goles_local_pred: Math.max(0, parseInt(p.golesLocal) || 0),
      goles_visitante_pred: Math.max(0, parseInt(p.golesVisitante) || 0),
    }));

    const { data: guardados, error: errUpsert } = await supabase
      .from("prode_pronosticos")
      .upsert(rowsToUpsert, { onConflict: "participante_id,partido_id" })
      .select();

    if (errUpsert) {
      console.error("Error al guardar pronósticos:", errUpsert);
      return NextResponse.json(
        { success: false, error: "Error al registrar tus pronósticos" },
        { status: 500, headers }
      );
    }

    return NextResponse.json(
      { 
        success: true, 
        message: "¡Pronósticos guardados con éxito!",
        guardados 
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
