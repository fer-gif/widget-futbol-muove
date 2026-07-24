import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    // 1. Obtener ID de Liga Necochea
    let { data: liga } = await supabase
      .from("ligas")
      .select("id")
      .ilike("nombre_liga", "%necochea%")
      .limit(1)
      .maybeSingle();

    if (!liga) {
      const { data: newLiga } = await supabase
        .from("ligas")
        .insert([{ nombre_liga: "Liga Necochea de Fútbol", es_profesional: false }])
        .select()
        .single();
      liga = newLiga;
    }

    const ligaId = liga ? liga.id : null;

    // 2. Datos de Tabla Oficial Fecha 11
    const standingsData = [
      // ZONA A
      { zona: "A", nombre_equipo: "Villa Díaz Vélez", logo_url: "/escudos_necochea/villa_diaz_velez.png", jugados: 11, ganados: 8, empatados: 1, perdidos: 2, goles_favor: 22, goles_contra: 12, diferencia_gol: 10, puntos: 25 },
      { zona: "A", nombre_equipo: "Ministerio", logo_url: "/escudos_necochea/ministerio.png", jugados: 11, ganados: 7, empatados: 2, perdidos: 2, goles_favor: 14, goles_contra: 6, diferencia_gol: 8, puntos: 23 },
      { zona: "A", nombre_equipo: "Independiente SC", logo_url: "/escudos_necochea/independiente_de_sancayetano.png", jugados: 11, ganados: 6, empatados: 3, perdidos: 2, goles_favor: 17, goles_contra: 10, diferencia_gol: 7, puntos: 21 },
      { zona: "A", nombre_equipo: "Mataderos", logo_url: "/escudos_necochea/mataderos.png", jugados: 11, ganados: 6, empatados: 2, perdidos: 3, goles_favor: 24, goles_contra: 12, diferencia_gol: 12, puntos: 20 },
      { zona: "A", nombre_equipo: "Sportivo", logo_url: "/escudos_necochea/sportivo_san_cayetano.png", jugados: 11, ganados: 3, empatados: 5, perdidos: 3, goles_favor: 11, goles_contra: 9, diferencia_gol: 2, puntos: 14 },
      { zona: "A", nombre_equipo: "Newbery", logo_url: "/escudos_necochea/newbery.png", jugados: 11, ganados: 2, empatados: 5, perdidos: 4, goles_favor: 11, goles_contra: 16, diferencia_gol: -5, puntos: 11 },
      { zona: "A", nombre_equipo: "Villa del Parque", logo_url: "/escudos_necochea/villa_del_parque.png", jugados: 11, ganados: 2, empatados: 5, perdidos: 4, goles_favor: 10, goles_contra: 15, diferencia_gol: -5, puntos: 11 },
      { zona: "A", nombre_equipo: "Rivadavia", logo_url: "/escudos_necochea/rivadavia.png", jugados: 11, ganados: 2, empatados: 4, perdidos: 5, goles_favor: 12, goles_contra: 18, diferencia_gol: -6, puntos: 10 },

      // ZONA B
      { zona: "B", nombre_equipo: "Estación Quequén", logo_url: "/escudos_necochea/estacion_quequen.png", jugados: 11, ganados: 7, empatados: 4, perdidos: 0, goles_favor: 20, goles_contra: 8, diferencia_gol: 12, puntos: 25 },
      { zona: "B", nombre_equipo: "Independiente L", logo_url: "/escudos_necochea/independiente_de_loberia.png", jugados: 11, ganados: 5, empatados: 3, perdidos: 3, goles_favor: 23, goles_contra: 14, diferencia_gol: 9, puntos: 18 },
      { zona: "B", nombre_equipo: "Gimnasia", logo_url: "/escudos_necochea/gimnasia_y_esgrima.png", jugados: 11, ganados: 5, empatados: 3, perdidos: 3, goles_favor: 16, goles_contra: 12, diferencia_gol: 4, puntos: 18 },
      { zona: "B", nombre_equipo: "Rec N Olivera", logo_url: "/escudos_necochea/nicanor_olivera.png", jugados: 11, ganados: 3, empatados: 3, perdidos: 5, goles_favor: 12, goles_contra: 17, diferencia_gol: -5, puntos: 12 },
      { zona: "B", nombre_equipo: "Def Pto Quequén", logo_url: "/escudos_necochea/defensores_de_pq.png", jugados: 11, ganados: 2, empatados: 2, perdidos: 7, goles_favor: 9, goles_contra: 24, diferencia_gol: -15, puntos: 8 },
      { zona: "B", nombre_equipo: "Huracán", logo_url: "/escudos_necochea/huracan_de_necochea.png", jugados: 11, ganados: 1, empatados: 4, perdidos: 6, goles_favor: 12, goles_contra: 21, diferencia_gol: -9, puntos: 7 },
      { zona: "B", nombre_equipo: "Defensores JNF", logo_url: "/escudos_necochea/defensores_de_jfernandez.png", jugados: 11, ganados: 1, empatados: 4, perdidos: 6, goles_favor: 12, goles_contra: 22, diferencia_gol: -10, puntos: 7 },
      { zona: "B", nombre_equipo: "Del Valle", logo_url: "/escudos_necochea/del_valle.png", jugados: 11, ganados: 1, empatados: 4, perdidos: 6, goles_favor: 7, goles_contra: 17, diferencia_gol: -10, puntos: 7 },
    ];

    // Limpiar y sembrar tabla `tablas_posiciones`
    await supabase.from("tablas_posiciones").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    const rowsToInsert = standingsData.map((s) => ({
      liga_id: ligaId,
      zona: s.zona,
      nombre_equipo: s.nombre_equipo,
      logo_url: s.logo_url,
      jugados: s.jugados,
      ganados: s.ganados,
      empatados: s.empatados,
      perdidos: s.perdidos,
      goles_favor: s.goles_favor,
      goles_contra: s.goles_contra,
      diferencia_gol: s.diferencia_gol,
      puntos: s.puntos,
    }));

    const { data: inserted, error: insertErr } = await supabase
      .from("tablas_posiciones")
      .insert(rowsToInsert)
      .select();

    if (insertErr) {
      console.error("Error sembrando tablas_posiciones:", insertErr);
      return NextResponse.json({ success: false, error: insertErr }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "¡Tablas de posiciones Zona A y Zona B sembradas exitosamente en Supabase DB!",
      registrosInsertados: inserted ? inserted.length : 0,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
