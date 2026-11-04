// Sincronización manual con ahorafutbol.ar.
// POST { modo?: "reciente" | "completo", liga_id?: uuid, simular?: boolean } — super-admin.
// También acepta un cron con "Authorization: Bearer <CRON_SECRET>" (modo reciente).
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { sincronizarPartidos } from "@/lib/sync-ahorafutbol";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const isCron = Boolean(cronSecret) && request.headers.get("authorization") === `Bearer ${cronSecret}`;
  if (!isCron) {
    const auth = await requireRole(["superadmin"]);
    if (auth.error) return auth.error;
  }

  const body = await request.json().catch(() => ({}));
  const modo = body?.modo === "completo" && !isCron ? "completo" : "reciente";
  const ligaId = typeof body?.liga_id === "string" ? body.liga_id : null;
  const simular = body?.simular === true;

  try {
    const resumen = await sincronizarPartidos({ ligaId, modo, simular });
    return NextResponse.json({ success: true, resumen });
  } catch (err) {
    console.error("[sync ahorafutbol]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "No se pudo sincronizar." },
      { status: 502 }
    );
  }
}
