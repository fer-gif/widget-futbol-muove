import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export type EquipoTabla = {
  posicion: number;
  equipo: string;
  logo?: string;
  jugados: number;
  ganados: number;
  empatados: number;
  perdidos: number;
  golesFavor: number;
  golesContra: number;
  diferenciaGol: number;
  puntos: number;
  zona: "A" | "B";
};

// Tablas base de la Liga Necochea de Fútbol (Fecha 11)
const baseZonaA: EquipoTabla[] = [
  { posicion: 1, equipo: "Villa Díaz Vélez", logo: "/escudos_necochea/villa_diaz_velez.png", jugados: 11, ganados: 8, empatados: 1, perdidos: 2, golesFavor: 22, golesContra: 12, diferenciaGol: 10, puntos: 25, zona: "A" },
  { posicion: 2, equipo: "Ministerio", logo: "/escudos_necochea/ministerio.png", jugados: 11, ganados: 7, empatados: 2, perdidos: 2, golesFavor: 14, golesContra: 6, diferenciaGol: 8, puntos: 23, zona: "A" },
  { posicion: 3, equipo: "Independiente SC", logo: "/escudos_necochea/independiente_de_sancayetano.png", jugados: 11, ganados: 6, empatados: 3, perdidos: 2, golesFavor: 17, golesContra: 10, diferenciaGol: 7, puntos: 21, zona: "A" },
  { posicion: 4, equipo: "Mataderos", logo: "/escudos_necochea/mataderos.png", jugados: 11, ganados: 6, empatados: 2, perdidos: 3, golesFavor: 24, golesContra: 12, diferenciaGol: 12, puntos: 20, zona: "A" },
  { posicion: 5, equipo: "Sportivo", logo: "/escudos_necochea/sportivo_san_cayetano.png", jugados: 11, ganados: 3, empatados: 5, perdidos: 3, golesFavor: 11, golesContra: 9, diferenciaGol: 2, puntos: 14, zona: "A" },
  { posicion: 6, equipo: "Newbery", logo: "/escudos_necochea/newbery.png", jugados: 11, ganados: 2, empatados: 5, perdidos: 4, golesFavor: 11, golesContra: 16, diferenciaGol: -5, puntos: 11, zona: "A" },
  { posicion: 7, equipo: "Villa del Parque", logo: "/escudos_necochea/villa_del_parque.png", jugados: 11, ganados: 2, empatados: 5, perdidos: 4, golesFavor: 10, golesContra: 15, diferenciaGol: -5, puntos: 11, zona: "A" },
  { posicion: 8, equipo: "Rivadavia", logo: "/escudos_necochea/rivadavia.png", jugados: 11, ganados: 2, empatados: 4, perdidos: 5, golesFavor: 12, golesContra: 18, diferenciaGol: -6, puntos: 10, zona: "A" },
];

const baseZonaB: EquipoTabla[] = [
  { posicion: 1, equipo: "Estación Quequén", logo: "/escudos_necochea/estacion_quequen.png", jugados: 11, ganados: 7, empatados: 4, perdidos: 0, golesFavor: 20, golesContra: 8, diferenciaGol: 12, puntos: 25, zona: "B" },
  { posicion: 2, equipo: "Independiente L", logo: "/escudos_necochea/independiente_de_loberia.png", jugados: 11, ganados: 5, empatados: 3, perdidos: 3, golesFavor: 23, golesContra: 14, diferenciaGol: 9, puntos: 18, zona: "B" },
  { posicion: 3, equipo: "Gimnasia", logo: "/escudos_necochea/gimnasia_y_esgrima.png", jugados: 11, ganados: 5, empatados: 3, perdidos: 3, golesFavor: 16, golesContra: 12, diferenciaGol: 4, puntos: 18, zona: "B" },
  { posicion: 4, equipo: "Rec N Olivera", logo: "/escudos_necochea/nicanor_olivera.png", jugados: 11, ganados: 3, empatados: 3, perdidos: 5, golesFavor: 12, golesContra: 17, diferenciaGol: -5, puntos: 12, zona: "B" },
  { posicion: 5, equipo: "Def Pto Quequén", logo: "/escudos_necochea/defensores_de_pq.png", jugados: 11, ganados: 2, empatados: 2, perdidos: 7, golesFavor: 9, golesContra: 24, diferenciaGol: -15, puntos: 8, zona: "B" },
  { posicion: 6, equipo: "Huracán", logo: "/escudos_necochea/huracan_de_necochea.png", jugados: 11, ganados: 1, empatados: 4, perdidos: 6, golesFavor: 12, golesContra: 21, diferenciaGol: -9, puntos: 7, zona: "B" },
  { posicion: 7, equipo: "Defensores JNF", logo: "/escudos_necochea/defensores_de_jfernandez.png", jugados: 11, ganados: 1, empatados: 4, perdidos: 6, golesFavor: 12, golesContra: 22, diferenciaGol: -10, puntos: 7, zona: "B" },
  { posicion: 8, equipo: "Del Valle", logo: "/escudos_necochea/del_valle.png", jugados: 11, ganados: 1, empatados: 4, perdidos: 6, golesFavor: 7, golesContra: 17, diferenciaGol: -10, puntos: 7, zona: "B" },
];

function normalizarNombre(nombre: string): string {
  const n = nombre.toLowerCase().trim();
  if (n.includes("díaz vélez") || n.includes("diaz velez")) return "villa díaz vélez";
  if (n.includes("ministerio")) return "ministerio";
  if (n.includes("san cayetano") && n.includes("independiente")) return "independiente sc";
  if (n.includes("mataderos")) return "mataderos";
  if (n.includes("sportivo")) return "sportivo";
  if (n.includes("newbery")) return "newbery";
  if (n.includes("parque")) return "villa del parque";
  if (n.includes("rivadavia")) return "rivadavia";
  if (n.includes("estación") || n.includes("estacion")) return "estación quequén";
  if (n.includes("lobería") || n.includes("loberia")) return "independiente l";
  if (n.includes("gimnasia")) return "gimnasia";
  if (n.includes("olivera") || n.includes("nicanor")) return "rec n olivera";
  if (n.includes("puerto") || n.includes("p.q")) return "def pto quequén";
  if (n.includes("huracán") || n.includes("huracan")) return "huracán";
  if (n.includes("fernández") || n.includes("jefernandez") || n.includes("jnf")) return "defensores jnf";
  if (n.includes("valle")) return "del valle";
  return n;
}

export async function GET(request: NextRequest) {
  try {
    // 1. Verificar si existen filas en la tabla `tablas_posiciones`
    const { data: dbStandings } = await supabase
      .from("tablas_posiciones")
      .select("*")
      .order("puntos", { ascending: false });

    let zonaA = JSON.parse(JSON.stringify(baseZonaA)) as EquipoTabla[];
    let zonaB = JSON.parse(JSON.stringify(baseZonaB)) as EquipoTabla[];

    if (dbStandings && dbStandings.length > 0) {
      const dbA = dbStandings.filter((s) => s.zona === "A");
      const dbB = dbStandings.filter((s) => s.zona === "B");

      if (dbA.length > 0) {
        zonaA = dbA.map((item, idx) => ({
          posicion: idx + 1,
          equipo: item.nombre_equipo,
          logo: item.logo_url,
          jugados: item.jugados,
          ganados: item.ganados,
          empatados: item.empatados,
          perdidos: item.perdidos,
          golesFavor: item.goles_favor,
          golesContra: item.goles_contra,
          diferenciaGol: item.diferencia_gol,
          puntos: item.puntos,
          zona: "A",
        }));
      }

      if (dbB.length > 0) {
        zonaB = dbB.map((item, idx) => ({
          posicion: idx + 1,
          equipo: item.nombre_equipo,
          logo: item.logo_url,
          jugados: item.jugados,
          ganados: item.ganados,
          empatados: item.empatados,
          perdidos: item.perdidos,
          golesFavor: item.goles_favor,
          golesContra: item.goles_contra,
          diferenciaGol: item.diferencia_gol,
          puntos: item.puntos,
          zona: "B",
        }));
      }
    } else {
      // 2. Si no hay tabla override manual, sumamos dinámicamente partidos con estado 'finalizado'
      const { data: partidosFinalizados } = await supabase
        .from("partidos")
        .select("*, equipo_local:equipos!partidos_equipo_local_id_fkey(nombre_equipo), equipo_visitante:equipos!partidos_equipo_visitante_id_fkey(nombre_equipo)")
        .eq("estado_partido", "finalizado");

      if (partidosFinalizados && partidosFinalizados.length > 0) {
        const todosEquipos = [...zonaA, ...zonaB];

        partidosFinalizados.forEach((p: any) => {
          const nombreLocal = p.equipo_local?.nombre_equipo || "";
          const nombreVis = p.equipo_visitante?.nombre_equipo || "";
          const gL = Number(p.goles_local || 0);
          const gV = Number(p.goles_visitante || 0);

          const localNorm = normalizarNombre(nombreLocal);
          const visNorm = normalizarNombre(nombreVis);

          const eqLocal = todosEquipos.find((e) => normalizarNombre(e.equipo) === localNorm);
          const eqVis = todosEquipos.find((e) => normalizarNombre(e.equipo) === visNorm);

          if (eqLocal) {
            eqLocal.jugados += 1;
            eqLocal.golesFavor += gL;
            eqLocal.golesContra += gV;
            eqLocal.diferenciaGol = eqLocal.golesFavor - eqLocal.golesContra;
            if (gL > gV) {
              eqLocal.ganados += 1;
              eqLocal.puntos += 3;
            } else if (gL === gV) {
              eqLocal.empatados += 1;
              eqLocal.puntos += 1;
            } else {
              eqLocal.perdidos += 1;
            }
          }

          if (eqVis) {
            eqVis.jugados += 1;
            eqVis.golesFavor += gV;
            eqVis.golesContra += gL;
            eqVis.diferenciaGol = eqVis.golesFavor - eqVis.golesContra;
            if (gV > gL) {
              eqVis.ganados += 1;
              eqVis.puntos += 3;
            } else if (gL === gV) {
              eqVis.empatados += 1;
              eqVis.puntos += 1;
            } else {
              eqVis.perdidos += 1;
            }
          }
        });

        // Re-ordenar Zona A y Zona B por Puntos > Diferencia de Gol > Goles a Favor
        const sortFn = (a: EquipoTabla, b: EquipoTabla) => {
          if (b.puntos !== a.puntos) return b.puntos - a.puntos;
          if (b.diferenciaGol !== a.diferenciaGol) return b.diferenciaGol - a.diferenciaGol;
          return b.golesFavor - a.golesFavor;
        };

        zonaA.sort(sortFn);
        zonaB.sort(sortFn);

        zonaA.forEach((item, idx) => { item.posicion = idx + 1; });
        zonaB.forEach((item, idx) => { item.posicion = idx + 1; });
      }
    }

    return NextResponse.json(
      {
        success: true,
        ligaNombre: "Liga Necochea de Fútbol - Primera",
        zonaA,
        zonaB,
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
