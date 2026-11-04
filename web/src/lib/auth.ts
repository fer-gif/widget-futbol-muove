// Autenticación del lado del servidor: sesiones firmadas (HMAC), hash de claves
// y límite de intentos fallidos. Solo para API routes / Server Components.
import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";

export type Role = "superadmin" | "periodista";

export type Session = {
  role: Role;
  clienteId: string | null; // periodista: medio al que pertenece
  nombre: string;
  exp: number; // epoch ms
};

export const SESSION_COOKIE = "muove_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET no está configurado (mínimo 32 caracteres).");
  }
  return secret;
}

const b64url = (buf: Buffer) => buf.toString("base64url");

function sign(data: string): string {
  return b64url(crypto.createHmac("sha256", getSecret()).update(data).digest());
}

export function createSessionToken(s: Omit<Session, "exp">): string {
  const payload: Session = { ...s, exp: Date.now() + SESSION_TTL_MS };
  const data = b64url(Buffer.from(JSON.stringify(payload)));
  return `${data}.${sign(data)}`;
}

export function verifySessionToken(token: string | undefined | null): Session | null {
  if (!token) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  let expected: string;
  try {
    expected = sign(data);
  } catch {
    return null;
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as Session;
    if (!payload.exp || payload.exp < Date.now()) return null;
    if (payload.role !== "superadmin" && payload.role !== "periodista") return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}

/** Devuelve la sesión si el rol está permitido, o una respuesta 401/403 lista para retornar. */
export async function requireRole(
  roles: Role[]
): Promise<{ session: Session; error?: never } | { session?: never; error: NextResponse }> {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 }) };
  }
  if (!roles.includes(session.role)) {
    return { error: NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 }) };
  }
  return { session };
}

// ---------------------------------------------------------------------------
// Token de jugador del Prode: prueba que quien pronostica es el dueño de la cuenta.
// Formato: <participanteId>.<exp>.<firma>
// ---------------------------------------------------------------------------
const PRODE_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 días

export function createProdeToken(participanteId: string): string {
  const exp = Date.now() + PRODE_TTL_MS;
  const data = `prode:${participanteId}.${exp}`;
  return `${participanteId}.${exp}.${sign(data)}`;
}

export function verifyProdeToken(token: unknown, participanteId: unknown): boolean {
  if (typeof token !== "string" || typeof participanteId !== "string") return false;
  const [pid, expStr, sig] = token.split(".");
  if (!pid || !expStr || !sig || pid !== participanteId) return false;
  if (Number(expStr) < Date.now()) return false;
  let expected: string;
  try {
    expected = sign(`prode:${pid}.${expStr}`);
  } catch {
    return false;
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const PRODE_SESSION_EXPIRED = "Tu sesión del Prode venció. Volvé a ingresar con tu email y PIN.";

// ---------------------------------------------------------------------------
// Hash de claves (scrypt con sal aleatoria). Formato: scrypt$<sal>$<hash>
// ---------------------------------------------------------------------------
export function hashSecret(secret: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(secret.trim(), salt, 32);
  return `scrypt$${b64url(salt)}$${b64url(hash)}`;
}

export function verifyHashedSecret(secret: string, stored: string | null | undefined): boolean {
  if (!stored || !stored.startsWith("scrypt$")) return false;
  const [, saltB64, hashB64] = stored.split("$");
  if (!saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64url");
  const actual = crypto.scryptSync(secret.trim(), Buffer.from(saltB64, "base64url"), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

/** Comparación en tiempo constante de dos strings. */
export function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// ---------------------------------------------------------------------------
// Límite de intentos (tabla auth_intentos). Si la tabla no existe todavía,
// no bloquea (fail-open) para no romper el login durante la migración.
// ---------------------------------------------------------------------------
const MAX_FALLOS = 5;
const BLOQUEO_MS = 15 * 60 * 1000;

export async function isBlocked(key: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("auth_intentos")
    .select("bloqueado_hasta")
    .eq("clave", key)
    .maybeSingle();
  if (error || !data?.bloqueado_hasta) return false;
  return new Date(data.bloqueado_hasta).getTime() > Date.now();
}

export async function registerFailure(key: string): Promise<void> {
  const { data, error } = await supabase
    .from("auth_intentos")
    .select("fallos, bloqueado_hasta")
    .eq("clave", key)
    .maybeSingle();
  if (error) return;
  // Si un bloqueo anterior ya venció, el contador vuelve a empezar.
  const vencido = data?.bloqueado_hasta && new Date(data.bloqueado_hasta).getTime() <= Date.now();
  const fallos = (vencido ? 0 : data?.fallos || 0) + 1;
  await supabase.from("auth_intentos").upsert({
    clave: key,
    fallos,
    bloqueado_hasta: fallos >= MAX_FALLOS ? new Date(Date.now() + BLOQUEO_MS).toISOString() : null,
    actualizado_at: new Date().toISOString(),
  });
}

export async function clearFailures(key: string): Promise<void> {
  await supabase.from("auth_intentos").delete().eq("clave", key);
}

export const BLOCKED_MESSAGE = "Demasiados intentos fallidos. Esperá 15 minutos y volvé a intentar.";
