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

// In-memory cache para mantener cambios en ejecución serverless (Vercel)
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
    // Si el disco es de solo lectura (Vercel serverless), inMemoryNews mantiene los datos en sesión
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

// GET: Obtener todas las noticias (activas o todas si es admin)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const all = searchParams.get("all") === "true";

    // 1. Intentar leer desde Supabase
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      try {
        let query = supabase.from("noticias").select("*").order("created_at", { ascending: false });
        if (!all) {
          query = query.eq("active", true);
        }
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          const mapped = data.map(mapFromSupabase);
          return NextResponse.json({ success: true, noticias: mapped });
        }
      } catch (e) {
        // Fallback si la tabla no existe aún en Supabase
      }
    }

    // 2. Fallback a memoria / archivo local
    let news = getLocalNews();
    if (!all) {
      news = news.filter((n) => n.active);
    }
    return NextResponse.json({ success: true, noticias: news });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Error al obtener noticias" }, { status: 500 });
  }
}

// POST: Crear, alternar o eliminar noticias
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, id, url, title, image, description, siteName, active } = body;

    let newsList = getLocalNews();

    // ACCIÓN: Eliminar noticia
    if (action === "delete") {
      if (!id) {
        return NextResponse.json({ success: false, error: "ID requerido para eliminar" }, { status: 400 });
      }

      // Eliminar de Supabase si está activo
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        try {
          await supabase.from("noticias").delete().eq("id", id);
        } catch (e) {
          console.error("Error al eliminar en Supabase:", e);
        }
      }

      // Eliminar localmente / en memoria
      newsList = newsList.filter((n) => String(n.id) !== String(id));
      saveLocalNews(newsList);

      // Si Supabase está disponible, responder con el dataset actualizado
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        try {
          const { data } = await supabase.from("noticias").select("*").order("created_at", { ascending: false });
          if (data) {
            return NextResponse.json({ success: true, noticias: data.map(mapFromSupabase) });
          }
        } catch (e) {}
      }

      return NextResponse.json({ success: true, noticias: newsList });
    }

    // ACCIÓN: Alternar estado activo / oculto
    if (action === "toggle") {
      if (!id) {
        return NextResponse.json({ success: false, error: "ID requerido para alternar" }, { status: 400 });
      }

      const target = newsList.find((n) => String(n.id) === String(id));
      const nextActive = target ? !target.active : false;

      // Actualizar en Supabase
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        try {
          await supabase.from("noticias").update({ active: nextActive }).eq("id", id);
        } catch (e) {
          console.error("Error al alternar estado en Supabase:", e);
        }
      }

      // Actualizar localmente
      newsList = newsList.map((n) => (String(n.id) === String(id) ? { ...n, active: nextActive } : n));
      saveLocalNews(newsList);

      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        try {
          const { data } = await supabase.from("noticias").select("*").order("created_at", { ascending: false });
          if (data) {
            return NextResponse.json({ success: true, noticias: data.map(mapFromSupabase) });
          }
        } catch (e) {}
      }

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

    // Guardar en Supabase
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      try {
        await supabase.from("noticias").upsert(mapToSupabase(newItem));
      } catch (e) {
        console.error("Error al hacer upsert en Supabase:", e);
      }
    }

    // Guardar localmente
    newsList = [newItem, ...newsList.filter((n) => String(n.id) !== String(newItem.id))];
    saveLocalNews(newsList);

    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      try {
        const { data } = await supabase.from("noticias").select("*").order("created_at", { ascending: false });
        if (data) {
          return NextResponse.json({ success: true, noticia: newItem, noticias: data.map(mapFromSupabase) });
        }
      } catch (e) {}
    }

    return NextResponse.json({ success: true, noticia: newItem, noticias: newsList });
  } catch (error) {
    console.error("Error guardando o eliminando noticia:", error);
    return NextResponse.json({ success: false, error: "Error interno al procesar la solicitud" }, { status: 500 });
  }
}
