import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import goleadoresData from "@/data/goleadores_data.json";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    // 1. Obtener los equipos registrados en Supabase
    const { data: equipos } = await supabase.from("equipos").select("id, nombre_equipo, logo_url");

    const appOrigin = process.env.NEXT_PUBLIC_APP_URL || "https://widget-futbol-muove.vercel.app";
    const formatLogoUrl = (logoUrl?: string | null): string => {
      if (!logoUrl) return "";
      if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) {
        return logoUrl;
      }
      const cleanPath = logoUrl.startsWith("/") ? logoUrl : `/${logoUrl}`;
      return `${appOrigin}${cleanPath}`;
    };

    // 2. Mapear cada goleador con su escudo correspondiente
    const goleadoresMapeados = goleadoresData.map((g: any, index: number) => {
      const eqMatched = (equipos || []).find((e: any) =>
        e.nombre_equipo.toLowerCase().includes(g.equipo.toLowerCase()) ||
        g.equipo.toLowerCase().includes(e.nombre_equipo.toLowerCase())
      );

      return {
        posicion: index + 1,
        nombre: g.nombre,
        equipo: eqMatched?.nombre_equipo || g.equipo,
        logo: formatLogoUrl(eqMatched?.logo_url),
        goles: g.goles
      };
    });

    return NextResponse.json(
      {
        success: true,
        total: goleadoresMapeados.length,
        goleadores: goleadoresMapeados
      },
      { status: 200, headers }
    );
  } catch (err: any) {
    console.error("API GOLEADORES ERROR:", err);
    return NextResponse.json(
      { success: false, error: err?.message || String(err) },
      { status: 500, headers }
    );
  }
}

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
