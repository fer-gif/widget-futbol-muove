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

// Equipos Base Zona A (Fecha 11)
const baseZonaA = [
  { equipo: "Villa Diaz Velez", jugados: 11, ganados: 8, empatados: 1, perdidos: 2, golesFavor: 22, golesContra: 12, diferenciaGol: 10, puntos: 25 },
  { equipo: "Ministerio", jugados: 11, ganados: 7, empatados: 2, perdidos: 2, golesFavor: 14, golesContra: 6, diferenciaGol: 8, puntos: 23 },
  { equipo: "Independiente de San Cayetano", jugados: 11, ganados: 6, empatados: 3, perdidos: 2, golesFavor: 17, golesContra: 10, diferenciaGol: 7, puntos: 21 },
  { equipo: "Mataderos", jugados: 11, ganados: 6, empatados: 2, perdidos: 3, golesFavor: 24, golesContra: 12, diferenciaGol: 12, puntos: 20 },
  { equipo: "Sportivo San Cayetano", jugados: 11, ganados: 3, empatados: 5, perdidos: 3, golesFavor: 11, golesContra: 9, diferenciaGol: 2, puntos: 14 },
  { equipo: "Newbery", jugados: 11, ganados: 2, empatados: 5, perdidos: 4, golesFavor: 11, golesContra: 16, diferenciaGol: -5, puntos: 11 },
  { equipo: "Villa del Parque", jugados: 11, ganados: 2, empatados: 5, perdidos: 4, golesFavor: 10, golesContra: 15, diferenciaGol: -5, puntos: 11 },
  { equipo: "Rivadavia", jugados: 11, ganados: 2, empatados: 4, perdidos: 5, golesFavor: 12, golesContra: 18, diferenciaGol: -6, puntos: 10 },
];

// Equipos Base Zona B (Fecha 11)
const baseZonaB = [
  { equipo: "Estación Quequén", jugados: 11, ganados: 7, empatados: 4, perdidos: 0, golesFavor: 20, golesContra: 8, diferenciaGol: 12, puntos: 25 },
  { equipo: "Independiente de Lobería", jugados: 11, ganados: 5, empatados: 3, perdidos: 3, golesFavor: 23, golesContra: 14, diferenciaGol: 9, puntos: 18 },
  { equipo: "Gimnasia y Esgrima", jugados: 11, ganados: 5, empatados: 3, perdidos: 3, golesFavor: 16, golesContra: 12, diferenciaGol: 4, puntos: 18 },
  { equipo: "Nicanor Olivera", jugados: 11, ganados: 3, empatados: 3, perdidos: 5, golesFavor: 12, golesContra: 17, diferenciaGol: -5, puntos: 12 },
  { equipo: "Defensores de P.Q", jugados: 11, ganados: 2, empatados: 2, perdidos: 7, golesFavor: 9, golesContra: 24, diferenciaGol: -15, puntos: 8 },
  { equipo: "Huracán de Necochea", jugados: 11, ganados: 1, empatados: 4, perdidos: 6, golesFavor: 12, golesContra: 21, diferenciaGol: -9, puntos: 7 },
  { equipo: "Defensores de Juan N. Fernández", jugados: 11, ganados: 1, empatados: 4, perdidos: 6, golesFavor: 12, golesContra: 22, diferenciaGol: -10, puntos: 7 },
  { equipo: "Del Valle", jugados: 11, ganados: 1, empatados: 4, perdidos: 6, golesFavor: 7, golesContra: 17, diferenciaGol: -10, puntos: 7 },
];

function normalizar(txt: string): string {
  return txt.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export async function GET(request: NextRequest) {
  try {
    // 1. Consultar equipos y tablas_posiciones en Supabase
    const { data: equiposDb } = await supabase.from("equipos").select("*");
    const { data: dbStandings } = await supabase
      .from("tablas_posiciones")
      .select("*, equipo:equipos!tablas_posiciones_equipo_id_fkey(id, nombre_equipo, logo_url)");

    const listaEquipos = equiposDb || [];

    function getLogo(nombreEq: string): string {
      const normBuscado = normalizar(nombreEq);
      const eq = listaEquipos.find((e) => {
        const normDb = normalizar(e.nombre_equipo || "");
        return normDb.includes(normBuscado) || normBuscado.includes(normDb);
      });
      return eq?.logo_url || `/escudos_necochea/${normBuscado.replace(/ /g, "_")}.png`;
    }

    let zonaA: EquipoTabla[] = [];
    let zonaB: EquipoTabla[] = [];

    if (dbStandings && dbStandings.length > 0) {
      const itemsA = dbStandings.filter((s) => s.zona === "A");
      const itemsB = dbStandings.filter((s) => s.zona === "B");

      if (itemsA.length > 0) {
        zonaA = itemsA.map((item, idx) => ({
          posicion: idx + 1,
          equipo: item.equipo?.nombre_equipo || item.nombre_equipo || "Equipo",
          logo: item.equipo?.logo_url || getLogo(item.nombre_equipo || ""),
          jugados: item.jugados || 0,
          ganados: item.ganados || 0,
          empatados: item.empatados || 0,
          perdidos: item.perdidos || 0,
          golesFavor: item.goles_favor || 0,
          golesContra: item.goles_contra || 0,
          diferenciaGol: item.diferencia_gol || 0,
          puntos: item.puntos || 0,
          zona: "A",
        }));
      }

      if (itemsB.length > 0) {
        zonaB = itemsB.map((item, idx) => ({
          posicion: idx + 1,
          equipo: item.equipo?.nombre_equipo || item.nombre_equipo || "Equipo",
          logo: item.equipo?.logo_url || getLogo(item.nombre_equipo || ""),
          jugados: item.jugados || 0,
          ganados: item.ganados || 0,
          empatados: item.empatados || 0,
          perdidos: item.perdidos || 0,
          golesFavor: item.goles_favor || 0,
          golesContra: item.goles_contra || 0,
          diferenciaGol: item.diferencia_gol || 0,
          puntos: item.puntos || 0,
          zona: "B",
        }));
      }
    }

    // Fallback de resguardo si tablas_posiciones aún está vacía o bloqueada por RLS
    if (zonaA.length === 0) {
      zonaA = baseZonaA.map((item, idx) => ({
        posicion: idx + 1,
        equipo: item.equipo,
        logo: getLogo(item.equipo),
        jugados: item.jugados,
        ganados: item.ganados,
        empatados: item.empatados,
        perdidos: item.perdidos,
        golesFavor: item.golesFavor,
        golesContra: item.golesContra,
        diferenciaGol: item.diferenciaGol,
        puntos: item.puntos,
        zona: "A",
      }));
    }

    if (zonaB.length === 0) {
      zonaB = baseZonaB.map((item, idx) => ({
        posicion: idx + 1,
        equipo: item.equipo,
        logo: getLogo(item.equipo),
        jugados: item.jugados,
        ganados: item.ganados,
        empatados: item.empatados,
        perdidos: item.perdidos,
        golesFavor: item.golesFavor,
        golesContra: item.golesContra,
        diferenciaGol: item.diferenciaGol,
        puntos: item.puntos,
        zona: "B",
      }));
    }

    // Sumar partidos finalizados en vivo
    const { data: partidosFinalizados } = await supabase
      .from("partidos")
      .select("*, equipo_local:equipos!partidos_equipo_local_id_fkey(nombre_equipo), equipo_visitante:equipos!partidos_equipo_visitante_id_fkey(nombre_equipo)")
      .eq("estado_partido", "finalizado");

    if (partidosFinalizados && partidosFinalizados.length > 0) {
      const todos = [...zonaA, ...zonaB];

      partidosFinalizados.forEach((p: any) => {
        const nomLocal = p.equipo_local?.nombre_equipo || "";
        const nomVis = p.equipo_visitante?.nombre_equipo || "";
        const gL = Number(p.goles_local || 0);
        const gV = Number(p.goles_visitante || 0);

        const eqL = todos.find((e) => normalizar(e.equipo).includes(normalizar(nomLocal)) || normalizar(nomLocal).includes(normalizar(e.equipo)));
        const eqV = todos.find((e) => normalizar(e.equipo).includes(normalizar(nomVis)) || normalizar(nomVis).includes(normalizar(e.equipo)));

        if (eqL) {
          eqL.jugados += 1;
          eqL.golesFavor += gL;
          eqL.golesContra += gV;
          eqL.diferenciaGol = eqL.golesFavor - eqL.golesContra;
          if (gL > gV) { eqL.ganados += 1; eqL.puntos += 3; }
          else if (gL === gV) { eqL.empatados += 1; eqL.puntos += 1; }
          else { eqL.perdidos += 1; }
        }

        if (eqV) {
          eqV.jugados += 1;
          eqV.golesFavor += gV;
          eqV.golesContra += gL;
          eqV.diferenciaGol = eqV.golesFavor - eqV.golesContra;
          if (gV > gL) { eqV.ganados += 1; eqV.puntos += 3; }
          else if (gL === gV) { eqV.empatados += 1; eqV.puntos += 1; }
          else { eqV.perdidos += 1; }
        }
      });
    }

    const sortFn = (a: EquipoTabla, b: EquipoTabla) => {
      if (b.puntos !== a.puntos) return b.puntos - a.puntos;
      if (b.diferenciaGol !== a.diferenciaGol) return b.diferenciaGol - a.diferenciaGol;
      return b.golesFavor - a.golesFavor;
    };

    zonaA.sort(sortFn);
    zonaB.sort(sortFn);

    zonaA.forEach((item, idx) => { item.posicion = idx + 1; });
    zonaB.forEach((item, idx) => { item.posicion = idx + 1; });

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
