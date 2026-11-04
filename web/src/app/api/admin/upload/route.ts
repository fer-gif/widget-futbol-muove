import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

const BUCKET = "club-logos";
const MAX_BYTES = 3 * 1024 * 1024; // 3 MB
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};
const FOLDERS = new Set(["logos", "sponsors"]);

export async function POST(req: NextRequest) {
  const auth = await requireRole(["superadmin"]);
  if (auth.error) return auth.error;

  try {
    const form = await req.formData();
    const file = form.get("file");
    const folder = String(form.get("folder") || "logos");

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Falta el archivo" }, { status: 400 });
    }
    if (!FOLDERS.has(folder)) {
      return NextResponse.json({ success: false, error: "Carpeta inválida" }, { status: 400 });
    }
    const ext = ALLOWED_TYPES[file.type];
    if (!ext) {
      return NextResponse.json({ success: false, error: "Formato no permitido (PNG, JPG, WEBP, GIF o SVG)" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ success: false, error: "La imagen supera los 3 MB" }, { status: 400 });
    }

    const path = `${folder}/${Date.now()}_${crypto.randomBytes(6).toString("hex")}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type });

    if (error) {
      return NextResponse.json({ success: false, error: `No se pudo subir la imagen: ${error.message}` }, { status: 500 });
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ success: true, url: data.publicUrl });
  } catch (err) {
    console.error("[admin/upload]", err);
    return NextResponse.json({ success: false, error: "Error al subir la imagen" }, { status: 500 });
  }
}
