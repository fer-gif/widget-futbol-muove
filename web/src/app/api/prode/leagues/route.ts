import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Generar código de invitación aleatorio corto de 6 caracteres (ej. ASADO26, NECO99)
function generarCodigoInvitacion(nombreGrupo: string): string {
  const clean = nombreGrupo.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const prefix = clean.substring(0, 4).padEnd(4, "X");
  const randomNum = Math.floor(10 + Math.random() * 90);
  return `${prefix}${randomNum}`;
}

// GET: Obtener las ligas privadas a las que pertenece un participante
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const participanteId = searchParams.get("participante-id");

    if (!participanteId) {
      return NextResponse.json(
        { success: false, error: "participante-id es requerido" },
        { status: 400, headers }
      );
    }

    const { data: membrecias, error } = await supabase
      .from("prode_miembros_liga")
      .select("liga_privada_id, prode_ligas_privadas!inner(id, nombre_grupo, codigo_invitacion, creador_id, created_at)")
      .eq("participante_id", participanteId);

    if (error) {
      console.error("Error al obtener ligas privadas:", error);
      return NextResponse.json(
        { success: false, error: "Error al consultar tus grupos de amigos" },
        { status: 500, headers }
      );
    }

    const ligas = (membrecias || []).map((m: any) => ({
      id: m.prode_ligas_privadas.id,
      nombre_grupo: m.prode_ligas_privadas.nombre_grupo,
      codigo_invitacion: m.prode_ligas_privadas.codigo_invitacion,
      es_creador: m.prode_ligas_privadas.creador_id === participanteId,
    }));

    return NextResponse.json(
      { success: true, ligas },
      { status: 200, headers }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500, headers }
    );
  }
}

// POST: Crear o Unirse a una Liga Privada
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, clientId, participanteId, nombreGrupo, codigoInvitacion } = body;

    if (!participanteId) {
      return NextResponse.json(
        { success: false, error: "participanteId es requerido" },
        { status: 400, headers }
      );
    }

    // 1. Crear Liga Privada de Amigos
    if (action === "create") {
      if (!clientId || !nombreGrupo) {
        return NextResponse.json(
          { success: false, error: "Faltan clientId y nombreGrupo para crear la liga" },
          { status: 400, headers }
        );
      }

      let codigo = generarCodigoInvitacion(nombreGrupo);
      
      // Intentar hasta 3 veces por si el código colisiona
      let creada = false;
      let nuevaLiga: any = null;

      for (let i = 0; i < 3; i++) {
        const { data, error } = await supabase
          .from("prode_ligas_privadas")
          .insert({
            cliente_id: clientId,
            creador_id: participanteId,
            nombre_grupo: nombreGrupo.trim(),
            codigo_invitacion: codigo,
          })
          .select()
          .single();

        if (!error && data) {
          creada = true;
          nuevaLiga = data;
          break;
        }
        codigo = generarCodigoInvitacion(nombreGrupo) + i;
      }

      if (!creada || !nuevaLiga) {
        return NextResponse.json(
          { success: false, error: "No se pudo crear la liga de amigos. Intentalo con otro nombre." },
          { status: 500, headers }
        );
      }

      // Unir automáticamente al creador a su propia liga
      await supabase
        .from("prode_miembros_liga")
        .insert({
          liga_privada_id: nuevaLiga.id,
          participante_id: participanteId,
        });

      return NextResponse.json(
        {
          success: true,
          message: "¡Liga de amigos creada con éxito!",
          liga: {
            id: nuevaLiga.id,
            nombre_grupo: nuevaLiga.nombre_grupo,
            codigo_invitacion: nuevaLiga.codigo_invitacion,
            es_creador: true,
          },
        },
        { status: 201, headers }
      );
    }

    // 2. Unirse a una Liga Privada existente con Código
    if (action === "join") {
      if (!codigoInvitacion) {
        return NextResponse.json(
          { success: false, error: "El código de invitación es requerido" },
          { status: 400, headers }
        );
      }

      const cleanCode = codigoInvitacion.trim().toUpperCase();

      // Buscar liga por código
      const { data: liga, error: errLiga } = await supabase
        .from("prode_ligas_privadas")
        .select("id, nombre_grupo, codigo_invitacion, creador_id")
        .eq("codigo_invitacion", cleanCode)
        .single();

      if (errLiga || !liga) {
        return NextResponse.json(
          { success: false, error: "Código de invitación no válido o inexistente" },
          { status: 404, headers }
        );
      }

      // Verificar si ya es miembro
      const { data: miembroExistente } = await supabase
        .from("prode_miembros_liga")
        .select("id")
        .eq("liga_privada_id", liga.id)
        .eq("participante_id", participanteId)
        .single();

      if (miembroExistente) {
        return NextResponse.json(
          {
            success: true,
            message: "Ya formas parte de esta liga de amigos",
            liga: {
              id: liga.id,
              nombre_grupo: liga.nombre_grupo,
              codigo_invitacion: liga.codigo_invitacion,
              es_creador: liga.creador_id === participanteId,
            },
          },
          { status: 200, headers }
        );
      }

      // Inscribir participante
      const { error: errJoin } = await supabase
        .from("prode_miembros_liga")
        .insert({
          liga_privada_id: liga.id,
          participante_id: participanteId,
        });

      if (errJoin) {
        console.error("Error al unirse a la liga:", errJoin);
        return NextResponse.json(
          { success: false, error: "Error al unirse a la liga de amigos" },
          { status: 500, headers }
        );
      }

      return NextResponse.json(
        {
          success: true,
          message: `¡Te uniste con éxito a '${liga.nombre_grupo}'!`,
          liga: {
            id: liga.id,
            nombre_grupo: liga.nombre_grupo,
            codigo_invitacion: liga.codigo_invitacion,
            es_creador: liga.creador_id === participanteId,
          },
        },
        { status: 200, headers }
      );
    }

    return NextResponse.json(
      { success: false, error: "Acción no válida (usar 'create' o 'join')" },
      { status: 400, headers }
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
