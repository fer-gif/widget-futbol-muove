// Tabla de posiciones calculada con los partidos finalizados que cargan los diarios.
// Parámetro opcional: ?liga=<uuid de nuestra liga> (por defecto, Liga Necochea).
//
// - Zonas: columna equipos.zona (migración 006). Sin zonas, una sola tabla.
// - Torneo actual: partidos desde ligas.torneo_inicio (si está cargado).
// - No cuentan las rondas finales (semis, final, reducido, etc.).
// - Si el mismo partido está cargado dos veces (por ejemplo, por dos diarios),
//   cuenta una sola vez.
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

export type EquipoTabla = {
  posicion: number;
  equipo: string;
  equipo_id?: string | null;
  logo?: string;
  jugados: number;
  ganados: number;
  empatados: number;
  perdidos: number;
  golesFavor: number;
  golesContra: number;
  diferenciaGol: number;
  puntos: number;
  zona: string;
};

const RONDA_FINAL = /semi|final|cuarto|octavo|reducido|promoci|play\s*-?\s*off|repechaje|desempate/i;

type Partido = {
  equipo_local_id: string;
  equipo_visitante_id: string;
  goles_local: number;
  goles_visitante: number;
  fecha_hora: string;
  jornada: string | null;
  cliente_id: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const liga = await resolverLiga(request.nextUrl.searchParams.get("liga"));
    if (!liga.ligaId) throw new Error("No hay ligas cargadas");

    let q = supabase
      .from("partidos")
      .select("equipo_local_id, equipo_visitante_id, goles_local, goles_visitante, fecha_hora, jornada, cliente_id")
      .eq("liga_id", liga.ligaId)
      .eq("estado_partido", "finalizado");
    if (liga.torneoInicio) q = q.gte("fecha_hora", `${liga.torneoInicio}T00:00:00-03:00`);
    const [{ data: partidos, error }, equipos] = await Promise.all([q, equiposDeLiga(liga.ligaId)]);
    if (error) throw error;

    const filas = new Map<string, EquipoTabla>();
    for (const e of equipos) {
      filas.set(e.id, {
        posicion: 0,
        equipo: e.nombre_equipo,
        equipo_id: e.id,
        logo: e.logo_url || "",
        jugados: 0, ganados: 0, empatados: 0, perdidos: 0,
        golesFavor: 0, golesContra: 0, diferenciaGol: 0, puntos: 0,
        zona: (e.zona || "A").toUpperCase(),
      });
    }

    // Un partido por cruce y día; si hay duplicados se prefiere el global (sin medio).
    const unicos = new Map<string, Partido>();
    for (const p of (partidos || []) as Partido[]) {
      if (p.jornada && RONDA_FINAL.test(p.jornada)) continue;
      const dia = new Date(Date.parse(p.fecha_hora) - 3 * 3600e3).toISOString().slice(0, 10);
      const clave = `${p.equipo_local_id}|${p.equipo_visitante_id}|${dia}`;
      const previo = unicos.get(clave);
      if (!previo || (previo.cliente_id && !p.cliente_id)) unicos.set(clave, p);
    }

    for (const p of unicos.values()) {
      const gl = Number(p.goles_local) || 0;
      const gv = Number(p.goles_visitante) || 0;
      for (const [id, a, b] of [[p.equipo_local_id, gl, gv], [p.equipo_visitante_id, gv, gl]] as const) {
        const f = filas.get(id);
        if (!f) continue;
        f.jugados++;
        f.golesFavor += a;
        f.golesContra += b;
        if (a > b) { f.ganados++; f.puntos += 3; }
        else if (a === b) { f.empatados++; f.puntos += 1; }
        else f.perdidos++;
      }
    }

    const porZona = new Map<string, EquipoTabla[]>();
    for (const f of filas.values()) {
      f.diferenciaGol = f.golesFavor - f.golesContra;
      porZona.set(f.zona, [...(porZona.get(f.zona) || []), f]);
    }
    const zonas = [...porZona.keys()].sort().map((z) =>
      porZona
        .get(z)!
        .sort((a, b) => b.puntos - a.puntos || b.diferenciaGol - a.diferenciaGol || b.golesFavor - a.golesFavor || a.equipo.localeCompare(b.equipo))
        .map((f, i) => ({ ...f, posicion: i + 1 }))
    );

    return NextResponse.json(
      {
        success: true,
        ligaNombre: liga.nombre || "Liga Necochea de Fútbol",
        zonaA: zonas[0] || [],
        zonaB: zonas[1] || [],
      },
      { status: 200, headers }
    );
  } catch (err) {
    console.error("[standings]", err);
    return NextResponse.json(
      { success: false, error: "La tabla de posiciones no está disponible en este momento." },
      { status: 500, headers: { ...headers, "Cache-Control": "public, s-maxage=30" } }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers });
}
