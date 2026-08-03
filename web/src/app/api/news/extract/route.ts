import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { success: false, error: "URL inválida o no proporcionada" },
        { status: 400 }
      );
    }

    // Validar formato de URL
    let targetUrl: URL;
    try {
      targetUrl = new URL(url.startsWith("http") ? url : `https://${url}`);
    } catch {
      return NextResponse.json(
        { success: false, error: "La URL ingresada no es válida." },
        { status: 400 }
      );
    }

    // Realizar la petición HTTP desde el servidor para evitar CORS
    const response = await fetch(targetUrl.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `No se pudo acceder a la página web (Error HTTP ${response.status}).`,
        },
        { status: 400 }
      );
    }

    const html = await response.text();

    // Helper regex de extracción de meta etiquetas
    const getMetaContent = (propertyOrName: string): string => {
      const regex = new RegExp(
        `<meta[^>]+(?:property|name)=["']${propertyOrName}["'][^>]+content=["']([^"']+)["']`,
        "i"
      );
      const match = html.match(regex);
      if (match && match[1]) return match[1].trim();

      // Probar orden inverso: content antes de property/name
      const reverseRegex = new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${propertyOrName}["']`,
        "i"
      );
      const reverseMatch = html.match(reverseRegex);
      return reverseMatch && reverseMatch[1] ? reverseMatch[1].trim() : "";
    };

    // 1. Título
    let title =
      getMetaContent("og:title") ||
      getMetaContent("twitter:title");
    if (!title) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      title = titleMatch ? titleMatch[1].trim() : "";
    }

    // 2. Imagen
    let image =
      getMetaContent("og:image") ||
      getMetaContent("og:image:secure_url") ||
      getMetaContent("twitter:image");

    // 3. Descripción
    let description =
      getMetaContent("og:description") ||
      getMetaContent("twitter:description") ||
      getMetaContent("description");

    // 4. Nombre del medio
    let siteName =
      getMetaContent("og:site_name") ||
      targetUrl.hostname.replace("www.", "").split(".")[0].toUpperCase();

    // Normalizar URLs de imagen relativas
    if (image && !image.startsWith("http")) {
      try {
        image = new URL(image, targetUrl.origin).toString();
      } catch {
        image = "";
      }
    }

    // Si aún no hay imagen, asignamos una por defecto de fútbol
    if (!image) {
      image = "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80";
    }

    // Limpieza HTML básica de entidades
    title = decodeEntities(title || "Noticia sin título");
    description = decodeEntities(description || "");

    return NextResponse.json({
      success: true,
      data: {
        url: targetUrl.toString(),
        title,
        image,
        description,
        siteName,
      },
    });
  } catch (error: any) {
    console.error("Error extrayendo metadatos de noticia:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error interno al procesar la URL de la noticia.",
      },
      { status: 500 }
    );
  }
}

function decodeEntities(encodedString: string) {
  return encodedString
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ntilde;/g, "ñ")
    .replace(/&Ntilde;/g, "Ñ")
    .replace(/&aacute;/g, "á")
    .replace(/&eacute;/g, "é")
    .replace(/&iacute;/g, "í")
    .replace(/&oacute;/g, "ó")
    .replace(/&uacute;/g, "ú");
}
