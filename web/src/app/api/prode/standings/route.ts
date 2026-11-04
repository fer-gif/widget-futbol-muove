// Tabla de posiciones del torneo actual, leída de ahorafutbol.ar.
// Parámetro opcional: ?liga=<uuid de nuestra liga> (por defecto, Liga Necochea).
import { NextRequest, NextResponse } from "next/server";
import { crearBuscadorEquipos, equiposDeLiga, obtenerLiga, resolverLiga } from "@/lib/ahorafutbol";

export const dynamic = "force-dynamic";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
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

export async function GET(request: NextRequest) {
  try {
    const liga = await resolverLiga(request.nextUrl.searchParams.get("liga"));
    const [datos, equipos] = await Promise.all([obtenerLiga(liga.ligaExterna), equiposDeLiga(liga.ligaId)]);
    const buscar = crearBuscadorEquipos(equipos);

    const zonas = datos.zonas.map(({ zona, filas }) =>
      filas.map<EquipoTabla>((f, i) => {
        const eq = buscar(f.clubId, f.nombre);
        return {
          posicion: i + 1,
          equipo: eq?.nombre_equipo || f.nombre,
          equipo_id: eq?.id ?? null,
          logo: eq?.logo_url || "",
          jugados: f.jugados,
          ganados: f.ganados,
          empatados: f.empatados,
          perdidos: f.perdidos,
          golesFavor: f.golesFavor,
          golesContra: f.golesContra,
          diferenciaGol: f.diferenciaGol,
          puntos: f.puntos,
          zona,
        };
      })
    );

    return NextResponse.json(
      {
        success: true,
        ligaNombre: datos.torneo || liga.nombre || "Liga Necochea de Fútbol",
        zonaA: zonas[0] || [],
        zonaB: zonas[1] || [],
        fuente: "ahorafutbol.ar",
        actualizado: datos.leido,
      },
      { status: 200, headers }
    );
  } catch (err) {
    console.error("[standings]", err);
    return NextResponse.json(
      { success: false, error: "La tabla de posiciones no está disponible en este momento." },
      { status: 503, headers: { ...headers, "Cache-Control": "public, s-maxage=60" } }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers });
}
