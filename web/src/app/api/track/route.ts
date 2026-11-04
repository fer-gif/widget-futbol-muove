// Registro de eventos del widget (impresiones y clics). Lo llama widget.js con
// navigator.sendBeacon desde los sitios de los medios, así que es público.
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EVENTOS: Record<string, string> = {
  impresion: "impresiones",
  sponsor: "clics_sponsor",
  prode: "clics_prode",
  interaccion: "interacciones",
};

export async function POST(req: NextRequest) {
  try {
    // sendBeacon manda text/plain para evitar el preflight CORS: se parsea a mano.
    const raw = await req.text();
    if (raw.length > 300) return new NextResponse(null, { status: 413, headers: CORS });
    const { c, e } = JSON.parse(raw || "{}");

    const campo = EVENTOS[String(e)];
    if (!campo || typeof c !== "string" || !UUID.test(c)) {
      return new NextResponse(null, { status: 400, headers: CORS });
    }

    const { error } = await supabase.rpc("incrementar_metrica", { p_cliente: c, p_campo: campo });
    // Un cliente inexistente falla por clave foránea: se ignora sin dar detalles.
    if (error && !/foreign key|violates/i.test(error.message)) {
      console.error("[track]", error.message);
    }
    return new NextResponse(null, { status: 204, headers: CORS });
  } catch {
    return new NextResponse(null, { status: 400, headers: CORS });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
