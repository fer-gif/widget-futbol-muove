import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Configurar cabeceras CORS para permitir consultas desde cualquier diario digital
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    const { searchParams } = new URL(request.url);
    let clientId = searchParams.get("client-id");
    const leaguesParam = searchParams.get("leagues");

    // Fallback automático para DataNE si no se especifica client-id
    if (!clientId) {
      const { data: clienteDataNE } = await supabase
        .from("clientes")
        .select("id")
        .ilike("nombre_medio", "%datane%")
        .limit(1);

      if (clienteDataNE && clienteDataNE.length > 0) {
        clientId = clienteDataNE[0].id;
      } else {
        const { data: anyCliente } = await supabase
          .from("clientes")
          .select("id")
          .limit(1);
        if (anyCliente && anyCliente.length > 0) {
          clientId = anyCliente[0].id;
        }
      }
    }

    // 1. Validar estado del cliente
    let cliente: any = null;
    if (clientId) {
      const { data: cData } = await supabase
        .from("clientes")
        .select("estado, nombre_medio")
        .eq("id", clientId)
        .single();
      cliente = cData;
    }

    if (!cliente) {
      // Si aún no hay clientes en la DB, responder con datos demostrativos por defecto de DataNE
      cliente = { estado: "activo", nombre_medio: "Diario DataNE" };
    }


    if (cliente.estado !== "activo") {
      return NextResponse.json(
        { 
          success: false, 
          status: "inactive", 
          message: "Suscripción suspendida o inactiva. Contacte a soporte de Muove Widgets." 
        },
        { status: 403, headers }
      );
    }

    const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    // 2. Obtener configuración de estilo
    let configGlobal = {
      color_primario: "#121214",
      color_secundario: "#00E676",
      logo_medio_url: null,
      mostrar_escudos: true
    };

    if (clientId && isUuid(clientId)) {
      const { data: configs } = await supabase
        .from("configuracion_widgets")
        .select("*")
        .eq("cliente_id", clientId);

      if (configs && configs.length > 0) {
        const found = configs.find(c => c.liga_id === null) || configs[0];
        configGlobal = { ...configGlobal, ...found };
      }
    }

    // 3. Obtener ligas autorizadas
    let ligasAutorizadas: string[] = [];

    if (clientId && isUuid(clientId)) {
      const { data: asignaciones } = await supabase
        .from("clientes_ligas")
        .select("liga_id")
        .eq("cliente_id", clientId);

      if (asignaciones && asignaciones.length > 0) {
        ligasAutorizadas = asignaciones.map(a => a.liga_id);
      }
    }

    // Si no hay ligas asignadas específicas, obtenemos todas las ligas registradas
    if (ligasAutorizadas.length === 0) {
      const { data: todasLigas } = await supabase.from("ligas").select("id");
      if (todasLigas) {
        ligasAutorizadas = todasLigas.map(l => l.id);
      }
    }

    // Filtrar ligas pedidas si viene leaguesParam
    if (leaguesParam && ligasAutorizadas.length > 0) {
      const leagueIds = leaguesParam.split(",").map(id => id.trim());
      ligasAutorizadas = ligasAutorizadas.filter(id => leagueIds.includes(id));
    }

    // 4. Obtener partidos de las ligas autorizadas
    let dataPartidos: any[] = [];
    if (ligasAutorizadas.length > 0) {
      const { data: partidosFound, error: partidosError } = await supabase
        .from("partidos")
        .select("*")
        .in("liga_id", ligasAutorizadas);

      if (!partidosError && partidosFound) {
        if (clientId && isUuid(clientId)) {
          dataPartidos = partidosFound.filter(p => !p.cliente_id || p.cliente_id === "todos" || p.cliente_id === clientId);
        } else {
          dataPartidos = partidosFound;
        }
      }
    } else {
      // Fallback: traer todos los partidos existentes
      const { data: todosPartidos } = await supabase.from("partidos").select("*");
      if (todosPartidos) {
        if (clientId && isUuid(clientId)) {
          dataPartidos = todosPartidos.filter(p => !p.cliente_id || p.cliente_id === "todos" || p.cliente_id === clientId);
        } else {
          dataPartidos = todosPartidos;
        }
      }
    }


    const { data: dataEquipos } = await supabase.from("equipos").select("*");
    const { data: dataLigas } = await supabase.from("ligas").select("*");

    const appOrigin = process.env.NEXT_PUBLIC_APP_URL || "https://widget-futbol-muove.vercel.app";
    const formatLogoUrl = (logoUrl?: string | null): string => {
      if (!logoUrl) return "";
      if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) {
        return logoUrl;
      }
      const cleanPath = logoUrl.startsWith("/") ? logoUrl : `/${logoUrl}`;
      return `${appOrigin}${cleanPath}`;
    };

    const now = new Date();

    const partidosMapeados = (dataPartidos || []).map((p: any) => {
      const local = dataEquipos?.find(e => e.id === p.equipo_local_id);
      const visitante = dataEquipos?.find(e => e.id === p.equipo_visitante_id);
      const liga = dataLigas?.find(l => l.id === p.liga_id);
      
      let estado = p.estado_partido;
      let minuto = p.minuto_actual;
      const start = p.fecha_hora ? new Date(p.fecha_hora) : null;

      // Lógica de auto "en vivo" si está programado pero ya comenzó
      if (p.estado_partido === "programado" && start && !isNaN(start.getTime()) && now >= start) {
        estado = "en_vivo";
        if (minuto === null) {
          const diffMin = Math.floor((now.getTime() - start.getTime()) / 60000);
          if (diffMin < 45) {
            minuto = diffMin;
          } else if (diffMin >= 45 && diffMin < 60) {
            minuto = "ET";
          } else if (diffMin >= 60 && diffMin < 105) {
            minuto = diffMin - 15;
          } else {
            minuto = "90+";
          }
        }
      }

      return {
        id: p.id,
        goles_local: p.goles_local,
        goles_visitante: p.goles_visitante,
        estado_partido: estado,
        fecha_hora: p.fecha_hora || null,
        minuto_actual: minuto,
        liga_nombre: liga?.nombre_liga || "Torneo",
        jornada: p.jornada || null,
        equipo_local: {
          nombre: local?.nombre_equipo || "Local",
          logo: formatLogoUrl(local?.logo_url)
        },
        equipo_visitante: {
          nombre: visitante?.nombre_equipo || "Visitante",
          logo: formatLogoUrl(visitante?.logo_url)
        }
      };
    });

    // Filtrar para mostrar únicamente los últimos partidos dentro de una ventana de 7 días respecto a la fecha más reciente cargada
    let partidosFiltrados7Dias = partidosMapeados;
    if (partidosMapeados.length > 0) {
      const fechasValidas = partidosMapeados
        .map(p => p.fecha_hora ? new Date(p.fecha_hora).getTime() : null)
        .filter((t): t is number => t !== null && !isNaN(t));

      if (fechasValidas.length > 0) {
        const maxFechaTime = Math.max(...fechasValidas);
        const sieteDiasMs = 7 * 24 * 60 * 60 * 1000;
        const minFechaTime = maxFechaTime - sieteDiasMs;

        partidosFiltrados7Dias = partidosMapeados.filter(p => {
          if (!p.fecha_hora) return true;
          const pTime = new Date(p.fecha_hora).getTime();
          if (isNaN(pTime)) return true;
          return pTime >= minFechaTime && pTime <= (maxFechaTime + (2 * 24 * 60 * 60 * 1000));
        });
      }
    }

    // Ordenar cronológicamente: en vivo primero, luego programados/demorados (el más cercano primero), y luego finalizados/suspendidos (el más reciente/nuevo primero)
    const partidosOrdenados = partidosFiltrados7Dias.sort((a, b) => {
      const getGrupo = (est: string) => {
        if (est === "en_vivo") return 0;
        if (est === "programado" || est === "demorado") return 1;
        return 2; // finalizado, suspendido
      };

      const grupoA = getGrupo(a.estado_partido);
      const grupoB = getGrupo(b.estado_partido);

      if (grupoA !== grupoB) {
        return grupoA - grupoB;
      }

      const timeA = a.fecha_hora && !isNaN(new Date(a.fecha_hora).getTime()) ? new Date(a.fecha_hora).getTime() : 9999999999999;
      const timeB = b.fecha_hora && !isNaN(new Date(b.fecha_hora).getTime()) ? new Date(b.fecha_hora).getTime() : 9999999999999;

      if (grupoA === 1) {
        // Programados/demorados: ordenar de forma ascendente por fecha (el más próximo primero)
        return timeA - timeB;
      } else {
        // En vivo o finalizados/suspendidos: ordenar de forma descendente por fecha (el más reciente primero)
        return timeB - timeA;
      }
    });

    let partidosResultado = partidosOrdenados;


    if (partidosResultado.length === 0 && partidosMapeados.length > 0) {
      partidosResultado = partidosMapeados;
    }


    const rawSec = configGlobal.color_secundario || "#00E676";
    let colorSec = rawSec;
    let colorFondoTarjeta = "#121214";
    let colorTextoPrincipal = "#f4f4f5";
    let colorTextoSecundario = "#a1a1aa";
    let fuenteFamilia = "sans-serif";

    if (rawSec.includes("|")) {
      const p = rawSec.split("|");
      colorSec = p[0] || "#00E676";
      colorFondoTarjeta = p[1] || "#121214";
      colorTextoPrincipal = p[2] || "#f4f4f5";
      colorTextoSecundario = p[3] || "#a1a1aa";
      fuenteFamilia = p[4] || "sans-serif";
    }

    const nombreMedioClean = (cliente?.nombre_medio || "").toLowerCase();
    const esDataNE = nombreMedioClean.includes("datane") || nombreMedioClean.includes("dataene");
    const mostrarProde = esDataNE || Boolean((configGlobal as any)?.mostrar_prode);

    return NextResponse.json(
      {
        success: true,
        nombre_medio: cliente.nombre_medio,
        estilo: {
          color_primario: configGlobal.color_primario,
          color_secundario: colorSec,
          color_fondo_tarjeta: colorFondoTarjeta,
          color_texto_principal: colorTextoPrincipal,
          color_texto_secundario: colorTextoSecundario,
          fuente_familia: fuenteFamilia,
          logo_medio_url: configGlobal.logo_medio_url,
          mostrar_escudos: configGlobal.mostrar_escudos,
          mostrar_prode: mostrarProde
        },
        partidos: partidosResultado
      },
      { status: 200, headers }
    );

  } catch (err: any) {
    console.error("API WIDGET ERROR:", err);
    return NextResponse.json(
      { success: false, error: err?.message || String(err) },
      { status: 500, headers }
    );
  }

}

// Habilitar soporte de preflight OPTIONS para CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
