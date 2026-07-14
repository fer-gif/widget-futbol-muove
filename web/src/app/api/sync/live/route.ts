import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  return handleSyncLive(request);
}

export async function POST(request: NextRequest) {
  return handleSyncLive(request);
}

async function handleSyncLive(request: NextRequest) {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "La clave API_FOOTBALL_KEY no está configurada." },
      { status: 500 }
    );
  }

  try {
    // 1. Obtener todas las ligas profesionales activas en nuestro sistema
    const { data: ligas, error: ligasErr } = await supabase
      .from("ligas")
      .select("id, api_liga_id, nombre_liga")
      .eq("es_profesional", true)
      .not("api_liga_id", "is", null);

    if (ligasErr) {
      throw new Error(`Error al consultar ligas: ${ligasErr.message}`);
    }

    if (!ligas || ligas.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No hay ligas profesionales configuradas en el sistema para sincronizar.",
        partidos_actualizados: 0
      });
    }

    const todayStr = new Date().toISOString().split("T")[0]; // Formato YYYY-MM-DD
    const currentSeason = new Date().getFullYear().toString();
    let totalUpdated = 0;

    console.log(`[Sync Live] Iniciando sincronización masiva para fecha: ${todayStr}`);

    for (const liga of ligas) {
      console.log(`[Sync Live] Consultando partidos de hoy para liga: ${liga.nombre_liga} (API ID: ${liga.api_liga_id})`);
      
      // Consultar partidos de hoy en la API para esta liga
      const response = await fetch(
        `https://v3.football.api-sports.io/fixtures?league=${liga.api_liga_id}&season=${currentSeason}&date=${todayStr}`,
        {
          method: "GET",
          headers: {
            "x-apisports-key": apiKey,
            "x-apisports-host": "v3.football.api-sports.io",
          },
        }
      );

      if (!response.ok) {
        console.error(`[Sync Live Error] No se pudo consultar la liga ${liga.nombre_liga}: ${response.statusText}`);
        continue;
      }

      const data = await response.json();
      if (data.errors && Object.keys(data.errors).length > 0) {
        console.error(`[Sync Live Error] La API devolvió errores para la liga ${liga.nombre_liga}: ${JSON.stringify(data.errors)}`);
        continue;
      }

      const apiFixtures = data.response || [];
      if (apiFixtures.length === 0) {
        console.log(`[Sync Live] Sin partidos programados hoy para la liga ${liga.nombre_liga}.`);
        continue;
      }

      // Obtener partidos existentes en nuestra base de datos para esta liga
      const { data: dbMatches } = await supabase
        .from("partidos")
        .select("id, api_partido_id")
        .eq("liga_id", liga.id);

      const dbMatchesMap = new Map<number, string>();
      if (dbMatches) {
        dbMatches.forEach(m => {
          if (m.api_partido_id) dbMatchesMap.set(m.api_partido_id, m.id);
        });
      }

      const matchesToUpdate = [];

      for (const f of apiFixtures) {
        const dbMatchId = dbMatchesMap.get(f.fixture.id);
        
        // Solo actualizamos si el partido ya está pre-cargado en nuestra DB
        if (dbMatchId) {
          const shortStatus = f.fixture.status.short;
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

          matchesToUpdate.push({
            id: dbMatchId,
            liga_id: liga.id, // Requerido para el Row-Level Security o integridad
            goles_local: f.goals.home ?? 0,
            goles_visitante: f.goals.away ?? 0,
            estado_partido: estado,
            minuto_actual: f.fixture.status.elapsed ?? null,
            fecha_hora: f.fixture.date,
            api_partido_id: f.fixture.id
          });
        }
      }

      if (matchesToUpdate.length > 0) {
        console.log(`[Sync Live] Actualizando ${matchesToUpdate.length} partidos para la liga ${liga.nombre_liga}`);
        const { error: upsertErr } = await supabase
          .from("partidos")
          .upsert(matchesToUpdate);

        if (upsertErr) {
          console.error(`[Sync Live Error] Error al realizar upsert en Supabase para liga ${liga.nombre_liga}: ${upsertErr.message}`);
        } else {
          totalUpdated += matchesToUpdate.length;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Sincronización masiva de partidos del día de hoy finalizada.",
      partidos_actualizados: totalUpdated
    });

  } catch (error: any) {
    console.error("[Sync Live Error Global]:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
