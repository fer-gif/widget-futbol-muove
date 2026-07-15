import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  return handleSyncMatch(request);
}

export async function POST(request: NextRequest) {
  return handleSyncMatch(request);
}

async function handleSyncMatch(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const apiPartidoIdStr = searchParams.get("api_partido_id");

  if (!apiPartidoIdStr) {
    return NextResponse.json(
      { success: false, error: "El parámetro 'api_partido_id' es requerido." },
      { status: 400 }
    );
  }

  const apiPartidoId = parseInt(apiPartidoIdStr, 10);
  if (isNaN(apiPartidoId)) {
    return NextResponse.json(
      { success: false, error: "El parámetro 'api_partido_id' debe ser un número válido." },
      { status: 400 }
    );
  }

  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "La clave API_FOOTBALL_KEY no está configurada en .env.local." },
      { status: 500 }
    );
  }

  try {
    console.log(`[Sync Match] Consultando API-Football para partido ID: ${apiPartidoId}`);
    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures?id=${apiPartidoId}`,
      {
        method: "GET",
        headers: {
          "x-apisports-key": apiKey,
          "x-apisports-host": "v3.football.api-sports.io",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Error de red al consultar API-Football: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.errors && Object.keys(data.errors).length > 0) {
      throw new Error(`Error devuelto por la API: ${JSON.stringify(data.errors)}`);
    }

    const apiFixtures = data.response || [];
    if (apiFixtures.length === 0) {
      return NextResponse.json(
        { success: false, error: `No se encontró el partido con ID ${apiPartidoId} en API-Football.` },
        { status: 404 }
      );
    }

    const f = apiFixtures[0];
    const shortStatus = f.fixture.status.short;

    // Mapear el estado a nuestro esquema
    let estado = "programado";
    if (["1H", "2H", "HT", "ET", "BT"].includes(shortStatus)) {
      estado = "en_vivo";
    } else if (["FT", "AET", "PEN"].includes(shortStatus)) {
      estado = "finalizado";
    } else if (["SUSP", "INT"].includes(shortStatus)) {
      estado = "suspendido";
    } else if (["PST", "CANC", "ABD"].includes(shortStatus)) {
      estado = "demorado";
    }

    const golesLocal = f.goals.home ?? 0;
    const golesVisitante = f.goals.away ?? 0;
    const minutoActual = f.fixture.status.elapsed ?? null;
    const fechaHora = f.fixture.date;

    const roundName = f.league?.round ? f.league.round.replace("Regular Season - ", "Fecha ") : null;

    console.log(`[Sync Match] Actualizando partido ID API ${apiPartidoId} -> Local: ${golesLocal}, Visitante: ${golesVisitante}, Estado: ${estado}, Minuto: ${minutoActual}, Jornada: ${roundName}`);

    const { data: updatedData, error: updateErr } = await supabase
      .from("partidos")
      .update({
        goles_local: golesLocal,
        goles_visitante: golesVisitante,
        estado_partido: estado,
        minuto_actual: minutoActual,
        fecha_hora: fechaHora,
        jornada: roundName
      })
      .eq("api_partido_id", apiPartidoId)
      .select();

    if (updateErr) {
      throw new Error(`Error al actualizar partido en Supabase: ${updateErr.message}`);
    }

    return NextResponse.json({
      success: true,
      message: "Partido sincronizado exitosamente.",
      partido: updatedData?.[0] || null
    });

  } catch (error: any) {
    console.error("[Sync Match Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
