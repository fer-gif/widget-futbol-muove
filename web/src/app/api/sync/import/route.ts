import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  return handleSync(request);
}

export async function POST(request: NextRequest) {
  return handleSync(request);
}

async function handleSync(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ligaId = searchParams.get("liga_id");
  const apiLigaId = searchParams.get("api_liga_id");
  const season = searchParams.get("season") || new Date().getFullYear().toString();

  if (!ligaId || !apiLigaId) {
    return NextResponse.json(
      { success: false, error: "Parámetros 'liga_id' y 'api_liga_id' son requeridos." },
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
    // 1. Sincronizar Equipos
    console.log(`[Import] Iniciando descarga de equipos para Liga API: ${apiLigaId}, Temporada: ${season}`);
    const teamsResponse = await fetch(
      `https://v3.football.api-sports.io/teams?league=${apiLigaId}&season=${season}`,
      {
        method: "GET",
        headers: {
          "x-apisports-key": apiKey,
          "x-apisports-host": "v3.football.api-sports.io",
        },
      }
    );

    if (!teamsResponse.ok) {
      throw new Error(`Error al consultar equipos en API-Football: ${teamsResponse.statusText}`);
    }

    const teamsData = await teamsResponse.json();
    if (teamsData.errors && Object.keys(teamsData.errors).length > 0) {
      throw new Error(`Error devuelto por la API: ${JSON.stringify(teamsData.errors)}`);
    }

    const apiTeams = teamsData.response || [];
    console.log(`[Import] Se obtuvieron ${apiTeams.length} equipos de la API.`);

    // Consultar equipos actuales de esta liga en Supabase para evitar duplicación
    const { data: existingTeams } = await supabase
      .from("equipos")
      .select("id, api_equipo_id")
      .eq("liga_id", ligaId);

    const existingTeamsMap = new Map<number, string>();
    if (existingTeams) {
      existingTeams.forEach((t) => {
        if (t.api_equipo_id) existingTeamsMap.set(t.api_equipo_id, t.id);
      });
    }

    const teamsToInsert = [];
    for (const item of apiTeams) {
      const teamId = item.team.id;
      if (!existingTeamsMap.has(teamId)) {
        teamsToInsert.push({
          liga_id: ligaId,
          nombre_equipo: item.team.name,
          logo_url: item.team.logo,
          es_profesional: true,
          api_equipo_id: teamId,
        });
      }
    }

    if (teamsToInsert.length > 0) {
      console.log(`[Import] Insertando ${teamsToInsert.length} equipos nuevos en Supabase.`);
      const { error: insertTeamsErr } = await supabase
        .from("equipos")
        .insert(teamsToInsert);

      if (insertTeamsErr) {
        throw new Error(`Error al guardar equipos en Supabase: ${insertTeamsErr.message}`);
      }
    } else {
      console.log(`[Import] Todos los equipos ya estaban registrados.`);
    }

    // Volver a consultar todos los equipos de la liga para tener el mapeo completo de ID_API -> UUID
    const { data: allTeams, error: fetchTeamsErr } = await supabase
      .from("equipos")
      .select("id, api_equipo_id")
      .eq("liga_id", ligaId);

    if (fetchTeamsErr || !allTeams) {
      throw new Error(`Error al re-consultar equipos: ${fetchTeamsErr?.message || "No se encontraron equipos"}`);
    }

    const teamsMap = new Map<number, string>();
    allTeams.forEach((t) => {
      if (t.api_equipo_id) teamsMap.set(t.api_equipo_id, t.id);
    });

    // 2. Sincronizar Fixtures (Partidos)
    console.log(`[Import] Iniciando descarga de partidos para Liga API: ${apiLigaId}, Temporada: ${season}`);
    const fixturesResponse = await fetch(
      `https://v3.football.api-sports.io/fixtures?league=${apiLigaId}&season=${season}`,
      {
        method: "GET",
        headers: {
          "x-apisports-key": apiKey,
          "x-apisports-host": "v3.football.api-sports.io",
        },
      }
    );

    if (!fixturesResponse.ok) {
      throw new Error(`Error al consultar fixtures en API-Football: ${fixturesResponse.statusText}`);
    }

    const fixturesData = await fixturesResponse.json();
    if (fixturesData.errors && Object.keys(fixturesData.errors).length > 0) {
      throw new Error(`Error devuelto por la API al traer partidos: ${JSON.stringify(fixturesData.errors)}`);
    }

    const apiFixtures = fixturesData.response || [];
    console.log(`[Import] Se obtuvieron ${apiFixtures.length} partidos de la API.`);

    // Consultar partidos actuales en Supabase para actualizar o insertar
    const { data: existingMatches } = await supabase
      .from("partidos")
      .select("id, api_partido_id")
      .eq("liga_id", ligaId);

    const existingMatchesMap = new Map<number, string>();
    if (existingMatches) {
      existingMatches.forEach((m) => {
        if (m.api_partido_id) existingMatchesMap.set(m.api_partido_id, m.id);
      });
    }

    const matchesToUpsert = apiFixtures
      .map((f: any) => {
        const localUuid = teamsMap.get(f.teams.home.id);
        const visitanteUuid = teamsMap.get(f.teams.away.id);

        if (!localUuid || !visitanteUuid) {
          console.warn(`[Import] Omitiendo partido ${f.fixture.id} porque falta local o visitante en la base de datos.`);
          return null;
        }

        // Mapeo de códigos de estado de la API a nuestro esquema de base de datos
        let estado = "programado";
        const shortStatus = f.fixture.status.short;
        if (["1H", "2H", "HT", "ET", "BT"].includes(shortStatus)) {
          estado = "en_vivo";
        } else if (["FT", "AET", "PEN"].includes(shortStatus)) {
          estado = "finalizado";
        } else if (["SUSP", "INT"].includes(shortStatus)) {
          estado = "suspendido";
        } else if (["PST", "CANC", "ABD"].includes(shortStatus)) {
          estado = "demorado";
        }

        const roundName = f.league?.round ? f.league.round.replace("Regular Season - ", "Fecha ") : null;

        const matchItem: any = {
          liga_id: ligaId,
          equipo_local_id: localUuid,
          equipo_visitante_id: visitanteUuid,
          goles_local: f.goals.home ?? 0,
          goles_visitante: f.goals.away ?? 0,
          estado_partido: estado,
          fecha_hora: f.fixture.date,
          api_partido_id: f.fixture.id,
          jornada: roundName
        };

        // Si ya existe, le inyectamos su UUID primario para que Supabase haga UPDATE en vez de INSERT
        const existingId = existingMatchesMap.get(f.fixture.id);
        if (existingId) {
          matchItem.id = existingId;
        }

        return matchItem;
      })
      .filter(Boolean);

    if (matchesToUpsert.length > 0) {
      console.log(`[Import] Guardando (Upsert) ${matchesToUpsert.length} partidos en Supabase.`);
      const { error: upsertErr } = await supabase
        .from("partidos")
        .upsert(matchesToUpsert);

      if (upsertErr) {
        throw new Error(`Error al guardar/actualizar partidos en Supabase: ${upsertErr.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Sincronización de liga profesional completada.",
      equipos_sincronizados: apiTeams.length,
      partidos_sincronizados: apiFixtures.length,
    });
  } catch (error: any) {
    console.error("[Import Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
