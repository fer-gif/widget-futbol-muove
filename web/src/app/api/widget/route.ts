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

    const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    // 1. Validar estado del cliente
    let cliente: any = null;
    if (clientId && isUuid(clientId)) {
      const { data: cData } = await supabase
        .from("clientes")
        .select("id, estado, nombre_medio")
        .eq("id", clientId)
        .single();
      cliente = cData;
    } else if (clientId) {
      const { data: cData } = await supabase
        .from("clientes")
        .select("id, estado, nombre_medio")
        .ilike("nombre_medio", `%${clientId}%`)
        .limit(1);
      if (cData && cData.length > 0) cliente = cData[0];
    }

    if (!cliente) {
      cliente = { id: null, estado: "activo", nombre_medio: "Diario DataNE" };
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

    const realClientId = cliente?.id || (clientId && isUuid(clientId) ? clientId : null);

    // 2. Obtener configuración de estilo
    let configGlobal = {
      color_primario: "#121214",
      color_secundario: "#00E676",
      logo_medio_url: null,
      mostrar_escudos: true
    };

    if (realClientId) {
      const { data: configs } = await supabase
        .from("configuracion_widgets")
        .select("*")
        .eq("cliente_id", realClientId);

      if (configs && configs.length > 0) {
        const found = configs.find(c => c.liga_id === null) || configs[0];
        configGlobal = { ...configGlobal, ...found };
      }
    }

    // 3. Obtener ligas autorizadas
    let ligasAutorizadas: string[] = [];

    if (realClientId) {
      const { data: asignaciones } = await supabase
        .from("clientes_ligas")
        .select("liga_id")
        .eq("cliente_id", realClientId);

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
        if (realClientId) {
          dataPartidos = partidosFound.filter(p => !p.cliente_id || p.cliente_id === "todos" || p.cliente_id === realClientId);
        } else {
          dataPartidos = partidosFound;
        }
      }
    } else {
      // Fallback: traer todos los partidos existentes
      const { data: todosPartidos } = await supabase.from("partidos").select("*");
      if (todosPartidos) {
        if (realClientId) {
          dataPartidos = todosPartidos.filter(p => !p.cliente_id || p.cliente_id === "todos" || p.cliente_id === realClientId);
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

    // Ordenar cronológicamente: en vivo primero, luego programados/demorados (el más cercano primero), y luego finalizados/suspendidos (el más reciente/nuevo primero)
    const partidosResultado = partidosMapeados.sort((a, b) => {
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
        return timeA - timeB;
      } else {
        return timeB - timeA;
      }
    });


    const colorSec = configGlobal.color_secundario || "#00E676";
    let colorFondoTarjeta = "#121214";
    let colorTextoPrincipal = "#f4f4f5";
    let colorTextoSecundario = "#a1a1aa";
    let fuenteFamilia = "sans-serif";
    let colorBorde1 = "#7F35B2";
    let colorBorde2 = "#EF426F";
    let sponsorUrl = "";
    const rawLogoVal: string | null = (configGlobal as any)?.logo_medio_url || null;
    let logoClean: string | null = rawLogoVal;

    if (rawLogoVal && rawLogoVal.includes("___CFG___")) {
      const parts = rawLogoVal.split("___CFG___");
      logoClean = parts[0] || null;
      if (parts[1]) {
        const cfg = parts[1].split("|");
        colorFondoTarjeta = cfg[0] || "#121214";
        colorTextoPrincipal = cfg[1] || "#f4f4f5";
        colorTextoSecundario = cfg[2] || "#a1a1aa";
        fuenteFamilia = cfg[3] || "sans-serif";
        colorBorde1 = cfg[4] || "#7F35B2";
        colorBorde2 = cfg[5] || "#EF426F";
        sponsorUrl = cfg[6] || "";
      }
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
          color_borde_1: colorBorde1,
          color_borde_2: colorBorde2,
          fuente_familia: fuenteFamilia,
          logo_medio_url: logoClean,
          sponsor_url: sponsorUrl,
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
