import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // 1. Liga Necochea
    let { data: liga } = await supabase
      .from('ligas')
      .select('*')
      .eq('nombre_liga', 'Liga Necochea')
      .maybeSingle();

    if (!liga) {
      const { data: newLiga, error: errLiga } = await supabase
        .from('ligas')
        .insert([{ nombre_liga: 'Liga Necochea', es_profesional: false }])
        .select()
        .single();

      if (errLiga) {
        return NextResponse.json({ success: false, step: 'liga', error: errLiga }, { status: 500 });
      }
      liga = newLiga;
    }

    // 2. Equipos
    const equiposList = [
      { nombre_equipo: "Del Valle", logo_url: "/escudos_necochea/del_valle.png" },
      { nombre_equipo: "Ministerio", logo_url: "/escudos_necochea/ministerio.png" },
      { nombre_equipo: "Estación Quequén", logo_url: "/escudos_necochea/estacion_quequen.png" },
      { nombre_equipo: "Villa Díaz Vélez", logo_url: "/escudos_necochea/villa_diaz_velez.png" },
      { nombre_equipo: "Rivadavia", logo_url: "/escudos_necochea/rivadavia.png" },
      { nombre_equipo: "Jorge Newbery", logo_url: "/escudos_necochea/newbery.png" },
      { nombre_equipo: "Defensores de P.Q", logo_url: "/escudos_necochea/defensores_de_pq.png" },
      { nombre_equipo: "Huracán de Necochea", logo_url: "/escudos_necochea/huracan_de_necochea.png" },
      { nombre_equipo: "Villa del Parque", logo_url: "/escudos_necochea/villa_del_parque.png" },
      { nombre_equipo: "Independiente de San Cayetano", logo_url: "/escudos_necochea/independiente_de_sancayetano.png" },
      { nombre_equipo: "Gimnasia y Esgrima", logo_url: "/escudos_necochea/gimnasia_y_esgrima.png" },
      { nombre_equipo: "Mataderos", logo_url: "/escudos_necochea/mataderos.png" },
      { nombre_equipo: "Independiente de Lobería", logo_url: "/escudos_necochea/independiente_de_loberia.png" },
      { nombre_equipo: "Nicanor Olivera", logo_url: "/escudos_necochea/nicanor_olivera.png" },
      { nombre_equipo: "Sportivo San Cayetano", logo_url: "/escudos_necochea/sportivo_san_cayetano.png" },
      { nombre_equipo: "Defensores de Juan N. Fernández", logo_url: "/escudos_necochea/defensores_de_jfernandez.png" }
    ];

    const equiposMap: Record<string, string> = {};

    for (const eq of equiposList) {
      let { data: existingEq } = await supabase
        .from('equipos')
        .select('*')
        .eq('nombre_equipo', eq.nombre_equipo)
        .maybeSingle();

      if (!existingEq) {
        const { data: newEq, error: errEq } = await supabase
          .from('equipos')
          .insert([{ ...eq, liga_id: liga.id, es_profesional: false }])
          .select()
          .single();

        if (!errEq && newEq) {
          existingEq = newEq;
        }
      }

      if (existingEq) {
        equiposMap[eq.nombre_equipo] = existingEq.id;
      }
    }

    // 3. Partidos demostrativos
    if (equiposMap["Del Valle"] && equiposMap["Ministerio"]) {
      await supabase.from('partidos').insert([{
        liga_id: liga.id,
        equipo_local_id: equiposMap["Del Valle"],
        equipo_visitante_id: equiposMap["Ministerio"],
        goles_local: 2,
        goles_visitante: 1,
        estado_partido: 'en_vivo',
        jornada: 'Fecha 1'
      }]);
    }

    if (equiposMap["Rivadavia"] && equiposMap["Mataderos"]) {
      await supabase.from('partidos').insert([{
        liga_id: liga.id,
        equipo_local_id: equiposMap["Rivadavia"],
        equipo_visitante_id: equiposMap["Mataderos"],
        goles_local: 0,
        goles_visitante: 0,
        estado_partido: 'programado',
        jornada: 'Fecha 1'
      }]);
    }

    return NextResponse.json({ success: true, message: '¡Datos de Liga Necochea insertados correctamente!', liga, countEquipos: Object.keys(equiposMap).length });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
