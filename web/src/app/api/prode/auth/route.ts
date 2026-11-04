import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import {
  BLOCKED_MESSAGE,
  clearFailures,
  createProdeToken,
  hashSecret,
  isBlocked,
  registerFailure,
  safeEqual,
  verifyHashedSecret,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const PUBLIC_COLS = "id, nombre, email, puntos_totales, racha_actual, cliente_id, created_at";

const json = (body: object, status = 200) => NextResponse.json(body, { status, headers });

/** Verifica el PIN contra el hash nuevo (scrypt) o el heredado (sha256 sin sal). */
function verifyPin(pin: string, stored: string | null | undefined): { ok: boolean; legacy: boolean } {
  if (!stored) return { ok: false, legacy: false };
  if (stored.startsWith("scrypt$")) return { ok: verifyHashedSecret(pin, stored), legacy: false };
  const legacyHash = crypto.createHash("sha256").update(pin.trim()).digest("hex");
  return { ok: safeEqual(legacyHash, stored), legacy: true };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, clientId, email, nombre, pin } = body;

    if (action === "reset_pin") {
      // Antes cualquiera podía cambiar el PIN de otra persona sabiendo solo su email.
      return json(
        {
          success: false,
          error: "Para recuperar tu PIN escribile al medio: lo pueden restablecer desde su panel.",
        },
        403
      );
    }

    if (!clientId || !email || !pin) {
      return json({ success: false, error: "Faltan campos obligatorios (clientId, email, pin)" }, 400);
    }
    const pinStr = String(pin).trim();
    if (!/^\d{4}$/.test(pinStr)) {
      return json({ success: false, error: "El PIN debe tener 4 números." }, 400);
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // 1. Iniciar Sesión (Login)
    if (action === "login") {
      const key = `prode:${clientId}:${cleanEmail}`;
      if (await isBlocked(key)) return json({ success: false, error: BLOCKED_MESSAGE }, 429);

      const { data: usuario } = await supabase
        .from("prode_participantes")
        .select(`${PUBLIC_COLS}, pin_hash`)
        .eq("cliente_id", clientId)
        .eq("email", cleanEmail)
        .maybeSingle();

      const check = verifyPin(pinStr, usuario?.pin_hash);
      if (!usuario || !check.ok) {
        await registerFailure(key);
        return json({ success: false, error: "Email o PIN incorrecto para este diario" }, 401);
      }

      await clearFailures(key);
      if (check.legacy) {
        // Migración transparente al hash con sal.
        await supabase.from("prode_participantes").update({ pin_hash: hashSecret(pinStr) }).eq("id", usuario.id);
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { pin_hash, ...publico } = usuario;
      return json({
        success: true,
        message: "Inicio de sesión exitoso",
        usuario: { ...publico, token: createProdeToken(usuario.id) },
      });
    }

    // 2. Registro de Usuario Nuevo
    if (action === "register") {
      if (!nombre || !String(nombre).trim()) {
        return json({ success: false, error: "El nombre o apodo es requerido" }, 400);
      }

      const { data: existente } = await supabase
        .from("prode_participantes")
        .select("id")
        .eq("cliente_id", clientId)
        .eq("email", cleanEmail)
        .maybeSingle();

      if (existente) {
        return json(
          { success: false, error: "Este email ya está registrado en este diario. Intentá iniciar sesión con tu PIN." },
          400
        );
      }

      const { data: nuevo, error: insertError } = await supabase
        .from("prode_participantes")
        .insert({
          cliente_id: clientId,
          nombre: String(nombre).trim().slice(0, 60),
          email: cleanEmail,
          pin_hash: hashSecret(pinStr),
          puntos_totales: 0,
          racha_actual: 0,
        })
        .select(PUBLIC_COLS)
        .single();

      if (insertError || !nuevo) {
        console.error("Error al registrar participante:", insertError);
        return json({ success: false, error: "Error interno al crear el registro del jugador" }, 500);
      }

      return json(
        { success: true, message: "Registro exitoso", usuario: { ...nuevo, token: createProdeToken(nuevo.id) } },
        201
      );
    }

    return json({ success: false, error: "Acción no válida (usar 'login' o 'register')" }, 400);
  } catch (err) {
    return json({ success: false, error: err instanceof Error ? err.message : "Error del servidor" }, 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers });
}
