import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { parseWidgetConfig } from "@/lib/widget-config";
import { matchClock } from "@/lib/match-clock";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// El widget consulta cada 30s desde cada visitante: el CDN de Vercel responde
// la mayoría de esas consultas sin tocar la base de datos.
const CACHE_OK = "public, s-maxage=15, stale-while-revalidate=45";
const CACHE_ERR = "public, s-maxage=60";

// Ventana de partidos que muestra el widget.
const DIAS_ATRAS = 10;
const DIAS_ADELANTE = 30;
const LIMITE_FALLBACK = 20;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Cliente = { id: string; estado: string; nombre_medio: string };

function respond(body: object, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { ...CORS, "Cache-Control": status === 200 ? CACHE_OK : CACHE_ERR },
  });
}

async function resolveCliente(clientIdParam: string | null): Promise<Cliente | null> {
  const cols = "id, estado, nombre_medio";

  if (clientIdParam && UUID.test(clientIdParam)) {
    const { data } = await supabase.from("clientes").select(cols).eq("id", clientIdParam).maybeSingle();
    return data;
  }

  if (clientIdParam) {
    // Compatibilidad: algunos embeds usan el nombre del medio en lugar del UUID.
    const { data } = await supabase.from("clientes").select(cols).ilike("nombre_medio", clientIdParam).limit(1);
    return data?.[0] || null;
  }

  // Sin client-id: cliente por defecto configurable por variable de entorno.
  const defaultId = process.env.DEFAULT_WIDGET_CLIENT_ID;
  if (defaultId && UUID.test(defaultId)) {
    const { data } = await supabase.from("clientes").select(cols).eq("id", defaultId).maybeSingle();
    if (data) return data;
  }

  // Compatibilidad heredada: embeds viejos de DataNE sin client-id.
  // Se puede borrar cuando DEFAULT_WIDGET_CLIENT_ID esté configurado.
  const { data } = await supabase
    .from("clientes")
    .select(cols)
    .or("nombre_medio.ilike.%datane%,nombre_medio.ilike.%dataene%")
    .limit(1);
  return data?.[0] || null;
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const cliente = await resolveCliente(params.get("client-id"));

    if (!cliente) {
      return respond({ success: false, status: "not_found", message: "Cliente no encontrado. Revisá el client-id." }, 404);
    }
    if (cliente.estado !== "activo") {
      return respond({ success: false, status: "inactive", message: "Suscripción suspendida o inactiva." }, 403);
    }

    // 1. Configuración visual + ligas autorizadas
    const [{ data: configs }, { data: asignaciones }] = await Promise.all([
      supabase
        .from("configuracion_widgets")
        .select("*")
        .eq("cliente_id", cliente.id)
        .neq("color_primario", "NOTICIAS_STORE"),
      supabase.from("clientes_ligas").select("liga_id").eq("cliente_id", cliente.id),
    ]);

    const configRow = (configs || []).find((c) => c.liga_id === null) || configs?.[0] || null;
    const estilo = parseWidgetConfig(configRow);

    let ligaIds: string[] | null = (asignaciones || []).map((a) => a.liga_id as string);
    if (ligaIds.length === 0) ligaIds = null; // sin asignaciones = todas las ligas

    const now = Date.now();
    const leaguesParam = params.get("leagues");
    if (leaguesParam) {
      const pedidas = leaguesParam.split(",").map((s) => s.trim()).filter((s) => UUID.test(s));
      ligaIds = ligaIds ? ligaIds.filter((id) => pedidas.includes(id)) : pedidas;
    }
    if (ligaIds && ligaIds.length === 0) {
      return respond({ success: true, cliente_id: cliente.id, nombre_medio: cliente.nombre_medio, estilo, partidos: [], server_time: now }, 200);
    }

    // 2. Partidos dentro de la ventana de fechas (o en vivo)
    const desde = new Date(now - DIAS_ATRAS * 864e5).toISOString();
    const hasta = new Date(now + DIAS_ADELANTE * 864e5).toISOString();

    // "*" para no depender de columnas opcionales (periodo, periodo_inicio) antes de la migración 004.
    const cols = "*";

    // range=all (lo usa el Prode) trae el fixture completo, sin ventana de fechas.
    const fixtureCompleto = params.get("range") === "all";

    let q = supabase.from("partidos").select(cols);
    if (!fixtureCompleto) {
      q = q.or(`estado_partido.eq.en_vivo,and(fecha_hora.gte.${desde},fecha_hora.lte.${hasta})`);
    }
    if (ligaIds) q = q.in("liga_id", ligaIds);
    let { data: partidos } = await q.limit(fixtureCompleto ? 2000 : 300);

    if (!partidos || partidos.length === 0) {
      // Temporada parada: mostrar los últimos partidos disponibles.
      let fb = supabase.from("partidos").select(cols).order("fecha_hora", { ascending: false });
      if (ligaIds) fb = fb.in("liga_id", ligaIds);
      ({ data: partidos } = await fb.limit(LIMITE_FALLBACK));
    }

    // Partidos exclusivos de otro medio no se muestran.
    partidos = (partidos || []).filter((p) => !p.cliente_id || p.cliente_id === cliente.id);

    // 3. Equipos y ligas de esos partidos
    const equipoIds = [...new Set(partidos.flatMap((p) => [p.equipo_local_id, p.equipo_visitante_id]))];
    const ligaIdsUsadas = [...new Set(partidos.map((p) => p.liga_id))];

    const [{ data: equipos }, { data: ligas }] = await Promise.all([
      equipoIds.length
        ? supabase.from("equipos").select("*").in("id", equipoIds) // "*": nombre_corto existe desde la migración 007
        : Promise.resolve({ data: [] as { id: string; nombre_equipo: string; logo_url: string | null; nombre_corto?: string | null }[] }),
      ligaIdsUsadas.length
        ? supabase.from("ligas").select("id, nombre_liga").in("id", ligaIdsUsadas)
        : Promise.resolve({ data: [] as { id: string; nombre_liga: string }[] }),
    ]);

    const equiposMap = new Map((equipos || []).map((e) => [e.id, e]));
    const ligasMap = new Map((ligas || []).map((l) => [l.id, l]));

    const appOrigin = process.env.NEXT_PUBLIC_APP_URL || "https://widget-futbol-muove.vercel.app";
    const formatLogoUrl = (logoUrl?: string | null): string => {
      if (!logoUrl) return "";
      if (/^https?:\/\//.test(logoUrl)) return logoUrl;
      return `${appOrigin}${logoUrl.startsWith("/") ? "" : "/"}${logoUrl}`;
    };

    const equipoJson = (e: { nombre_equipo: string; logo_url: string | null; nombre_corto?: string | null } | undefined, porDefecto: string) => ({
      nombre: e?.nombre_equipo || porDefecto,
      corto: e?.nombre_corto?.trim() || e?.nombre_equipo || porDefecto,
      logo: formatLogoUrl(e?.logo_url),
    });

    const resultado = partidos.map((p) => {
      const local = equiposMap.get(p.equipo_local_id);
      const visitante = equiposMap.get(p.equipo_visitante_id);

      const reloj = matchClock(p, now);
      const estado = reloj.estado;
      const minuto = reloj.minuto;

      return {
        id: p.id,
        goles_local: p.goles_local,
        goles_visitante: p.goles_visitante,
        estado_partido: estado,
        fecha_hora: p.fecha_hora || null,
        minuto_actual: minuto, // compatibilidad: ahora es texto ("37'", "ET"...)
        minuto,
        minuto_estimado: reloj.estimado,
        // Para que el widget haga avanzar el minuto sin volver a consultar.
        reloj:
          estado === "en_vivo" && (p.periodo === "1T" || p.periodo === "2T" || p.periodo === "ET")
            ? { periodo: p.periodo, inicio: p.periodo_inicio || null }
            : null,
        liga_nombre: ligasMap.get(p.liga_id)?.nombre_liga || "Torneo",
        jornada: p.jornada || null,
        equipo_local: equipoJson(local, "Local"),
        equipo_visitante: equipoJson(visitante, "Visitante"),
      };
    });

    // En vivo primero; luego próximos (más cercano primero); luego resultados (más reciente primero).
    const grupo = (e: string) => (e === "en_vivo" ? 0 : e === "programado" || e === "demorado" ? 1 : 2); // a_confirmar va con resultados
    const t = (f: string | null) => (f ? new Date(f).getTime() || Infinity : Infinity);
    resultado.sort((a, b) => {
      const ga = grupo(a.estado_partido);
      const gb = grupo(b.estado_partido);
      if (ga !== gb) return ga - gb;
      return ga === 1 ? t(a.fecha_hora) - t(b.fecha_hora) : t(b.fecha_hora) - t(a.fecha_hora);
    });

    return respond(
      { success: true, cliente_id: cliente.id, nombre_medio: cliente.nombre_medio, estilo, partidos: resultado, server_time: now },
      200
    );
  } catch (err) {
    console.error("API WIDGET ERROR:", err);
    return NextResponse.json(
      { success: false, error: "Error interno del widget" },
      { status: 500, headers: { ...CORS, "Cache-Control": "no-store" } }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
