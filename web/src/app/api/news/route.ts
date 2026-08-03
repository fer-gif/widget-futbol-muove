import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { supabase } from "@/lib/supabase";

export interface NewsItem {
  id: string;
  url: string;
  title: string;
  image: string;
  description: string;
  siteName: string;
  active: boolean;
  createdAt: string;
}

const LOCAL_DATA_PATH = path.join(process.cwd(), "src", "data", "noticias.json");

// Cache en memoria para la instancia
let inMemoryNews: NewsItem[] | null = null;

function getLocalNews(): NewsItem[] {
  if (inMemoryNews) return inMemoryNews;
  try {
    if (fs.existsSync(LOCAL_DATA_PATH)) {
      const content = fs.readFileSync(LOCAL_DATA_PATH, "utf-8");
      inMemoryNews = JSON.parse(content);
      return inMemoryNews!;
    }
  } catch (e) {
    console.error("Error leyendo noticias locales:", e);
  }
  return [];
}

function saveLocalNews(news: NewsItem[]) {
  inMemoryNews = news;
  try {
    const dir = path.dirname(LOCAL_DATA_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_DATA_PATH, JSON.stringify(news, null, 2), "utf-8");
  } catch (e) {
    // Disco en solo lectura en Vercel
  }
}

function mapFromSupabase(item: any): NewsItem {
  return {
    id: String(item.id),
    url: item.url,
    title: item.title,
    image: item.image,
    description: item.description || "",
    siteName: item.site_name || item.siteName || "Noticias",
    active: item.active !== false,
    createdAt: item.created_at || item.createdAt || new Date().toISOString(),
  };
}

function mapToSupabase(item: NewsItem): any {
  return {
    id: item.id,
    url: item.url,
    title: item.title,
    image: item.image,
    description: item.description,
    site_name: item.siteName,
    active: item.active,
    created_at: item.createdAt,
  };
}

// ------------------------------------------------------------------
// PERSISTENCIA GARANTIZADA EN SUPABASE
// ------------------------------------------------------------------
async function getSupabaseNews(): Promise<NewsItem[] | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }

  // 1. Probar tabla dedicada 'noticias'
  try {
    const { data, error } = await supabase.from("noticias").select("*").order("created_at", { ascending: false });
    if (!error && data && data.length > 0) {
      return data.map(mapFromSupabase);
    }
  } catch (e) {}

  // 2. Probar almacén persistente en 'configuracion_widgets' (para prevenir reseteos en redeploys)
  try {
    const { data, error } = await supabase
      .from("configuracion_widgets")
      .select("logo_medio_url")
      .eq("color_primario", "NOTICIAS_STORE")
      .maybeSingle();

    if (!error && data && data.logo_medio_url) {
      const parsed = JSON.parse(data.logo_medio_url);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}

  return null;
}

async function saveSupabaseNews(newsList: NewsItem[]) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return;
  }

  // 1. Guardar en tabla 'noticias' si existe
  try {
    for (const item of newsList) {
      await supabase.from("noticias").upsert(mapToSupabase(item));
    }
  } catch (e) {}

  // 2. Guardar en respaldo permanente en 'configuracion_widgets'
  try {
    const payload = {
      cliente_id: "00000000-0000-0000-0000-000000000000",
      color_primario: "NOTICIAS_STORE",
      color_secundario: "#000000",
      logo_medio_url: JSON.stringify(newsList),
      mostrar_escudos: true,
    };

    const { data: existing } = await supabase
      .from("configuracion_widgets")
      .select("id")
      .eq("color_primario", "NOTICIAS_STORE")
      .maybeSingle();

    if (existing) {
      await supabase.from("configuracion_widgets").update(payload).eq("id", existing.id);
    } else {
      await supabase.from("configuracion_widgets").insert([payload]);
    }
  } catch (e) {
    console.error("Error guardando noticias en Supabase:", e);
  }
}

async function deleteFromSupabase(id: string) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return;
  }
  try {
    await supabase.from("noticias").delete().eq("id", id);
  } catch (e) {}
}

// GET: Obtener noticias (activas o todas)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const all = searchParams.get("all") === "true";

    // 1. Intentar obtener desde Supabase
    let news = await getSupabaseNews();

    // 2. Fallback a memoria / local
    if (!news) {
      news = getLocalNews();
    }

    // Actualizar cache en memoria
    inMemoryNews = news;

    if (!all) {
      news = news.filter((n) => n.active);
    }
    return NextResponse.json({ success: true, noticias: news });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Error al obtener noticias" }, { status: 500 });
  }
}

// POST: Crear, alternar, reordenar o eliminar noticias
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, id, url, title, image, description, siteName, active, newsList: inputNewsList } = body;

    let newsList = (await getSupabaseNews()) || getLocalNews();

    // ACCIÓN: Reordenar
    if (action === "reorder" && Array.isArray(inputNewsList)) {
      const baseTime = Date.now();
      const reorderedNews: NewsItem[] = inputNewsList.map((item: NewsItem, idx: number) => ({
        ...item,
        createdAt: new Date(baseTime - idx * 1000).toISOString(),
      }));

      saveLocalNews(reorderedNews);
      await saveSupabaseNews(reorderedNews);

      return NextResponse.json({ success: true, noticias: reorderedNews });
    }

    // ACCIÓN: Eliminar
    if (action === "delete") {
      if (!id) {
        return NextResponse.json({ success: false, error: "ID requerido para eliminar" }, { status: 400 });
      }

      await deleteFromSupabase(id);
      newsList = newsList.filter((n) => String(n.id) !== String(id));

      saveLocalNews(newsList);
      await saveSupabaseNews(newsList);

      return NextResponse.json({ success: true, noticias: newsList });
    }

    // ACCIÓN: Alternar activo / oculto
    if (action === "toggle") {
      if (!id) {
        return NextResponse.json({ success: false, error: "ID requerido para alternar" }, { status: 400 });
      }

      const target = newsList.find((n) => String(n.id) === String(id));
      const nextActive = target ? !target.active : false;

      newsList = newsList.map((n) => (String(n.id) === String(id) ? { ...n, active: nextActive } : n));

      saveLocalNews(newsList);
      await saveSupabaseNews(newsList);

      return NextResponse.json({ success: true, noticias: newsList });
    }

    // ACCIÓN: Crear nueva noticia
    if (!url || !title) {
      return NextResponse.json({ success: false, error: "URL y título son obligatorios" }, { status: 400 });
    }

    const newItem: NewsItem = {
      id: id || `news-${Date.now()}`,
      url,
      title,
      image: image || "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80",
      description: description || "",
      siteName: siteName || "Noticias",
      active: active !== undefined ? active : true,
      createdAt: new Date().toISOString(),
    };

    newsList = [newItem, ...newsList.filter((n) => String(n.id) !== String(newItem.id))];

    saveLocalNews(newsList);
    await saveSupabaseNews(newsList);

    return NextResponse.json({ success: true, noticia: newItem, noticias: newsList });
  } catch (error) {
    console.error("Error procesando solicitud de noticias:", error);
    return NextResponse.json({ success: false, error: "Error interno al procesar la solicitud" }, { status: 500 });
  }
}
