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

function getLocalNews(): NewsItem[] {
  try {
    if (fs.existsSync(LOCAL_DATA_PATH)) {
      const content = fs.readFileSync(LOCAL_DATA_PATH, "utf-8");
      return JSON.parse(content);
    }
  } catch (e) {
    console.error("Error leyendo noticias locales:", e);
  }
  return [];
}

function saveLocalNews(news: NewsItem[]) {
  try {
    const dir = path.dirname(LOCAL_DATA_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_DATA_PATH, JSON.stringify(news, null, 2), "utf-8");
  } catch (e) {
    console.error("Error guardando noticias locales:", e);
  }
}

// GET: Obtener todas las noticias (activas o todas si es admin)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const all = searchParams.get("all") === "true";

    // Intentar leer de Supabase si está disponible
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      try {
        let query = supabase.from("noticias").select("*").order("created_at", { ascending: false });
        if (!all) {
          query = query.eq("active", true);
        }
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          return NextResponse.json({ success: true, noticias: data });
        }
      } catch (e) {
        // Si la tabla noticias aún no existe en Supabase, caemos en el almacenamiento local
      }
    }

    let news = getLocalNews();
    if (!all) {
      news = news.filter((n) => n.active);
    }
    return NextResponse.json({ success: true, noticias: news });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Error al obtener noticias" }, { status: 500 });
  }
}

// POST: Crear o actualizar noticia
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, id, url, title, image, description, siteName, active } = body;

    let newsList = getLocalNews();

    if (action === "toggle") {
      newsList = newsList.map((n) => (n.id === id ? { ...n, active: !n.active } : n));
      saveLocalNews(newsList);
      return NextResponse.json({ success: true, noticias: newsList });
    }

    if (action === "delete") {
      newsList = newsList.filter((n) => n.id !== id);
      saveLocalNews(newsList);
      return NextResponse.json({ success: true, noticias: newsList });
    }

    // Crear nueva noticia
    if (!url || !title) {
      return NextResponse.json({ success: false, error: "URL y título son obligatorios" }, { status: 400 });
    }

    const newItem: NewsItem = {
      id: id || `news-${Date.now()}`,
      url,
      title,
      image: image || "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80",
      description: description || "",
      siteName: siteName || "Necochea Fútbol",
      active: active !== undefined ? active : true,
      createdAt: new Date().toISOString(),
    };

    // Intentar guardar en Supabase
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      try {
        await supabase.from("noticias").upsert(newItem);
      } catch (e) {}
    }

    // Guardar también en el almacenamiento local para sincronización garantizada
    newsList = [newItem, ...newsList.filter((n) => n.id !== newItem.id)];
    saveLocalNews(newsList);

    return NextResponse.json({ success: true, noticia: newItem, noticias: newsList });
  } catch (error) {
    console.error("Error guardando noticia:", error);
    return NextResponse.json({ success: false, error: "Error al guardar noticia" }, { status: 500 });
  }
}
