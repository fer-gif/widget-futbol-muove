import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("client-id");

    let query = supabase
      .from("prode_participantes")
      .select("id, nombre, email, puntos_totales, racha_actual, cliente_id, created_at, clientes(nombre_medio)");

    if (clientId && clientId !== "todos") {
      query = query.eq("cliente_id", clientId);
    }

    const { data: participantes, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("Error al obtener participantes del Prode:", error);
      return NextResponse.json(
        { success: false, error: "Error al consultar la base de datos" },
        { status: 500, headers }
      );
    }

    // Obtener la cantidad de pronósticos por participante
    const { data: pronosticos } = await supabase
      .from("prode_pronosticos")
      .select("participante_id");

    const pronosticosCountMap = new Map<string, number>();
    (pronosticos || []).forEach((p) => {
      const current = pronosticosCountMap.get(p.participante_id) || 0;
      pronosticosCountMap.set(p.participante_id, current + 1);
    });

    const resultado = (participantes || []).map((p: any) => ({
      id: p.id,
      nombre: p.nombre,
      email: p.email,
      puntos_totales: p.puntos_totales || 0,
      racha_actual: p.racha_actual || 0,
      cliente_id: p.cliente_id,
      nombre_medio: p.clientes?.nombre_medio || "General / Muove",
      created_at: p.created_at,
      total_pronosticos: pronosticosCountMap.get(p.id) || 0,
    }));

    return NextResponse.json(
      {
        success: true,
        count: resultado.length,
        participantes: resultado,
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

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID de participante es requerido" },
        { status: 400, headers }
      );
    }

    const { error } = await supabase
      .from("prode_participantes")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500, headers }
      );
    }

    return NextResponse.json(
      { success: true, message: "Participante eliminado correctamente" },
      { status: 200, headers }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500, headers }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers });
}
