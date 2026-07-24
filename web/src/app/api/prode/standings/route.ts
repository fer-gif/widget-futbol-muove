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

export async function GET(request: NextRequest) {
  try {
    // 1. Consultar la tabla relacional tablas_posiciones uniéndola directamente con public.equipos
    const { data: dbStandings, error: errStandings } = await supabase
      .from("tablas_posiciones")
      .select("*, equipo:equipos!tablas_posiciones_equipo_id_fkey(id, nombre_equipo, logo_url)")
      .order("puntos", { ascending: false });

    let zonaA: EquipoTabla[] = [];
    let zonaB: EquipoTabla[] = [];

    if (dbStandings && dbStandings.length > 0) {
      const itemsA = dbStandings.filter((s) => s.zona === "A");
      const itemsB = dbStandings.filter((s) => s.zona === "B");

      zonaA = itemsA.map((item, idx) => ({
        posicion: idx + 1,
        equipo: item.equipo?.nombre_equipo || item.nombre_equipo || "Equipo",
        logo: item.equipo?.logo_url || item.logo_url || "",
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

      zonaB = itemsB.map((item, idx) => ({
        posicion: idx + 1,
        equipo: item.equipo?.nombre_equipo || item.nombre_equipo || "Equipo",
        logo: item.equipo?.logo_url || item.logo_url || "",
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

    // Sort por Puntos > Diferencia de Gol > Goles a Favor
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
