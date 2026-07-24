import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Función para hashear el PIN de 4 dígitos
function hashPin(pin: string): string {
  return crypto.createHash("sha256").update(pin.trim()).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, clientId, email, nombre, pin } = body;

    if (!clientId || !email || !pin) {
      return NextResponse.json(
        { success: false, error: "Faltan campos obligatorios (clientId, email, pin)" },
        { status: 400, headers }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const pinHash = hashPin(pin);

    // 1. Iniciar Sesión (Login)
    if (action === "login") {
      const { data: usuario, error } = await supabase
        .from("prode_participantes")
        .select("id, nombre, email, puntos_totales, racha_actual, cliente_id, created_at")
        .eq("cliente_id", clientId)
        .eq("email", cleanEmail)
        .eq("pin_hash", pinHash)
        .single();

      if (error || !usuario) {
        return NextResponse.json(
          { success: false, error: "Email o PIN incorrecto para este diario" },
          { status: 401, headers }
        );
      }

      return NextResponse.json(
        { success: true, message: "Inicio de sesión exitoso", usuario },
        { status: 200, headers }
      );
    }

    // 2. Registro de Usuario Nuevo
    if (action === "register") {
      if (!nombre) {
        return NextResponse.json(
          { success: false, error: "El nombre o apodo es requerido" },
          { status: 400, headers }
        );
      }

      // Verificar si el email ya existe en este diario
      const { data: existente } = await supabase
        .from("prode_participantes")
        .select("id")
        .eq("cliente_id", clientId)
        .eq("email", cleanEmail)
        .single();

      if (existente) {
        return NextResponse.json(
          { success: false, error: "Este email ya está registrado en este diario. Intentá iniciar sesión con tu PIN." },
          { status: 400, headers }
        );
      }

      // Registrar nuevo participante
      const { data: nuevo, error: insertError } = await supabase
        .from("prode_participantes")
        .insert({
          cliente_id: clientId,
          nombre: nombre.trim(),
          email: cleanEmail,
          pin_hash: pinHash,
          puntos_totales: 0,
          racha_actual: 0
        })
        .select("id, nombre, email, puntos_totales, racha_actual, cliente_id, created_at")
        .single();

      if (insertError || !nuevo) {
        console.error("Error al registrar participante:", insertError);
        return NextResponse.json(
          { success: false, error: "Error interno al crear el registro del jugador" },
          { status: 500, headers }
        );
      }

      return NextResponse.json(
        { success: true, message: "Registro exitoso", usuario: nuevo },
        { status: 201, headers }
      );
    }

    return NextResponse.json(
      { success: false, error: "Acción no válida (usar 'login' o 'register')" },
      { status: 400, headers }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Error del servidor" },
      { status: 500, headers }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers });
}
