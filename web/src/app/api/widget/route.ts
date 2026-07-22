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
    const clientId = searchParams.get("client-id");
    const leaguesParam = searchParams.get("leagues");

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: "client-id es requerido" },
        { status: 400, headers }
      );
    }

    // 1. Validar estado del cliente
    const { data: cliente, error: clientError } = await supabase
      .from("clientes")
      .select("estado, nombre_medio")
      .eq("id", clientId)
      .single();

    if (clientError || !cliente) {
      return NextResponse.json(
        { success: false, error: "Cliente no registrado o inexistente" },
        { status: 404, headers }
      );
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

    // 2. Obtener configuración de estilo
    // Intentamos buscar una configuración global (liga_id es null)
    const { data: configs } = await supabase
      .from("configuracion_widgets")
      .select("*")
      .eq("cliente_id", clientId);
    
    // Configuración por defecto si no existe una específica
    const configGlobal = configs?.find(c => c.liga_id === null) || configs?.[0] || {
      color_primario: "#121214",
      color_secundario: "#00E676",
      logo_medio_url: null,
      mostrar_escudos: true
    };

    // 3. Obtener ligas autorizadas mediante clientes_ligas
    const { data: asignaciones, error: errAsig } = await supabase
      .from("clientes_ligas")
      .select("liga_id")
      .eq("cliente_id", clientId);

    if (errAsig) {
      return NextResponse.json(
        { success: false, error: "Error al validar suscripciones del cliente" },
        { status: 500, headers }
      );
    }

    const ligasAsignadas = (asignaciones || []).map(a => a.liga_id);

    // Filtrar ligas pedidas
    let ligasAutorizadas = ligasAsignadas;
    if (leaguesParam) {
      const leagueIds = leaguesParam.split(",").map(id => id.trim());
      ligasAutorizadas = ligasAsignadas.filter(id => leagueIds.includes(id));
    }


    // 4. Obtener partidos de las ligas autorizadas (filtrado a los últimos 5 días y futuros)
    let dataPartidos: any[] = [];
    if (ligasAutorizadas.length > 0) {
      const limitDate = new Date();
      limitDate.setDate(limitDate.getDate() - 5);

      const { data, error: partidosError } = await supabase
        .from("partidos")
        .select("*")
        .in("liga_id", ligasAutorizadas)
        .or(`fecha_hora.gte.${limitDate.toISOString()},fecha_hora.is.null`)
        .or(`cliente_id.eq.${clientId},cliente_id.is.null`)
        .order("fecha_hora", { ascending: false });

      if (partidosError) {
        return NextResponse.json(
          { success: false, error: "Error al consultar los encuentros" },
          { status: 500, headers }
        );
      }
      dataPartidos = data || [];
    }

    const { data: dataEquipos } = await supabase.from("equipos").select("*");
    const { data: dataLigas } = await supabase.from("ligas").select("*");

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
          logo: local?.logo_url || ""
        },
        equipo_visitante: {
          nombre: visitante?.nombre_equipo || "Visitante",
          logo: visitante?.logo_url || ""
        }
      };
    });

    // Ordenar cronológicamente: en vivo primero, luego programados/demorados (el más cercano primero), y luego finalizados/suspendidos (el más reciente/nuevo primero)
    const partidosOrdenados = partidosMapeados.sort((a, b) => {
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

    return NextResponse.json(
      {
        success: true,
        nombre_medio: cliente.nombre_medio,
        estilo: {
          color_primario: configGlobal.color_primario,
          color_secundario: configGlobal.color_secundario,
          logo_medio_url: configGlobal.logo_medio_url,
          mostrar_escudos: configGlobal.mostrar_escudos
        },
        partidos: partidosOrdenados
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
