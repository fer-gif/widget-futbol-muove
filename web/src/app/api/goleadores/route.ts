// Tabla de goleadores del torneo actual, leída de ahorafutbol.ar.
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

export async function GET(request: NextRequest) {
  try {
    const liga = await resolverLiga(request.nextUrl.searchParams.get("liga"));
    const [datos, equipos] = await Promise.all([obtenerLiga(liga.ligaExterna), equiposDeLiga(liga.ligaId)]);
    const buscar = crearBuscadorEquipos(equipos);

    // El nombre del club no viene en la tabla de goleadores: se toma de las posiciones.
    const nombresSitio = new Map<number, string>();
    for (const z of datos.zonas) for (const f of z.filas) nombresSitio.set(f.clubId, f.nombre);

    const goleadores = datos.goleadores.map((g, i) => {
      const nombreSitio = g.clubId != null ? nombresSitio.get(g.clubId) : undefined;
      const eq = buscar(g.clubId, nombreSitio);
      return {
        posicion: i + 1,
        nombre: g.nombre,
        equipo: eq?.nombre_equipo || nombreSitio || "",
        logo: eq?.logo_url || "",
        goles: g.goles,
      };
    });

    return NextResponse.json(
      {
        success: true,
        total: goleadores.length,
        goleadores,
        torneo: datos.torneo,
        fuente: "ahorafutbol.ar",
        actualizado: datos.leido,
      },
      { status: 200, headers }
    );
  } catch (err) {
    console.error("[goleadores]", err);
    return NextResponse.json(
      { success: false, error: "La tabla de goleadores no está disponible en este momento." },
      { status: 503, headers: { ...headers, "Cache-Control": "public, s-maxage=60" } }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers });
}
