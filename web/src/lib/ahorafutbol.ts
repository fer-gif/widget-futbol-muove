// Lector de ahorafutbol.ar: posiciones y goleadores del torneo actual de una liga.
//
// El sitio no tiene una API pública: se lee el HTML de ligas.php. Para no
// depender de él en cada visita se guarda una copia en memoria (5 min) y otra en
// la base (tabla fuente_externa_cache, migración 006) que se usa si el sitio no
// responde. Solo servidor.
import { supabase } from "@/lib/supabase-server";

export const AHORAFUTBOL_URL = "https://www.ahorafutbol.ar";
/** Liga Necochea 1ra. División Masculino (ligas.php?i=1). */
export const AHORAFUTBOL_LIGA_DEFAULT = 1;

const TTL_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 8000;
const USER_AGENT = "Mozilla/5.0 (compatible; MuoveWidget/1.0; +https://widget-futbol-muove.vercel.app)";

export type FilaPosicion = {
  clubId: number;
  nombre: string;
  puntos: number;
  jugados: number;
  ganados: number;
  empatados: number;
  perdidos: number;
  golesFavor: number;
  golesContra: number;
  diferenciaGol: number;
};

export type ZonaPosiciones = { zona: string; filas: FilaPosicion[] };

export type Goleador = { nombre: string; clubId: number | null; goles: number };

export type LigaSnapshot = {
  ligaExterna: number;
  torneo: string;
  zonas: ZonaPosiciones[];
  goleadores: Goleador[];
  /** Momento en que se leyó del sitio (ISO). */
  leido: string;
};

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

/**
 * El sitio mezcla UTF-8 y Latin-1 en la misma página ("Estación" en Latin-1 y
 * "Villa Díaz Vélez" en UTF-8). Se decodifica byte a byte: las secuencias UTF-8
 * válidas como UTF-8 y el resto como Windows-1252.
 */
export function decodificarMixto(bytes: Uint8Array): string {
  const cp1252 = new TextDecoder("windows-1252");
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b < 0x80) {
      out += String.fromCharCode(b);
      i++;
      continue;
    }
    const largo = b >= 0xf0 && b <= 0xf4 ? 4 : b >= 0xe0 ? 3 : b >= 0xc2 && b <= 0xdf ? 2 : 0;
    let valido = largo > 0 && i + largo <= bytes.length;
    for (let k = 1; valido && k < largo; k++) valido = (bytes[i + k] & 0xc0) === 0x80;
    if (valido) {
      out += new TextDecoder("utf-8").decode(bytes.subarray(i, i + largo));
      i += largo;
    } else {
      out += cp1252.decode(bytes.subarray(i, i + 1));
      i++;
    }
  }
  return out;
}

const ENTIDADES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
  ntilde: "ñ", Ntilde: "Ñ", uuml: "ü", Uuml: "Ü", ldquo: "“", rdquo: "”",
};

export function textoPlano(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTIDADES[n] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

const MINUSCULAS = new Set(["de", "del", "la", "las", "los", "y"]);

/** "ezequiel  cerica" → "Ezequiel Cerica". */
export function capitalizar(nombre: string): string {
  return nombre
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Parseo de ligas.php
// ---------------------------------------------------------------------------

export function parsearLiga(html: string, ligaExterna: number): Omit<LigaSnapshot, "leido"> {
  // Tablas de posiciones: un panel por zona, con encabezado "<torneo> GRUPO A".
  const zonasPorTorneo = new Map<string, ZonaPosiciones[]>();
  const panelRe = /<p class="panel-heading"[^>]*>([\s\S]*?)<\/p>\s*<div class="panel-block">\s*<table[^>]*>([\s\S]*?)<\/table>/g;
  for (const m of html.matchAll(panelRe)) {
    const [, encabezadoHtml, tabla] = m;
    if (!/title="Puntos"/.test(tabla)) continue;
    const encabezado = textoPlano(encabezadoHtml);
    const z = encabezado.match(/^(.*?)\s*(?:-\s*)?(?:grupo|zona)\s+(\S+)$/i);
    const torneo = (z ? z[1] : encabezado).trim();
    const zona = z ? z[2].toUpperCase() : "A";

    const filas: FilaPosicion[] = [];
    for (const fila of tabla.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
      const club = fila[1].match(/club\.php\?i=(\d+)"?[^>]*>([\s\S]*?)<\/a>/);
      if (!club) continue;
      const nums = [...fila[1].matchAll(/<td class='has-text-centered'>\s*(?:<strong>)?\s*(-?\d+)/g)].map((x) => Number(x[1]));
      if (nums.length < 8) continue;
      const [puntos, jugados, ganados, empatados, perdidos, golesFavor, golesContra, diferenciaGol] = nums;
      filas.push({
        clubId: Number(club[1]),
        nombre: textoPlano(club[2]),
        puntos, jugados, ganados, empatados, perdidos, golesFavor, golesContra, diferenciaGol,
      });
    }
    if (filas.length === 0) continue;
    const lista = zonasPorTorneo.get(torneo) ?? [];
    lista.push({ zona, filas });
    zonasPorTorneo.set(torneo, lista);
  }

  // El torneo actual es el primero que aparece en la página.
  const [torneo, zonas] = zonasPorTorneo.entries().next().value ?? ["", []];

  // Goleadores: tabla completa oculta con id="tableg".
  const goleadores: Goleador[] = [];
  const inicio = html.indexOf('id="tableg"');
  if (inicio >= 0) {
    const fin = html.indexOf("</table>", inicio);
    const tabla = html.slice(inicio, fin > 0 ? fin : undefined);
    for (const fila of tabla.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
      const nombre = fila[1].match(/<td class='is-capitalized'>([\s\S]*?)<\/td>/);
      const goles = fila[1].match(/<td class='has-text-centered'>\s*(\d+)/);
      if (!nombre || !goles) continue;
      const hex = fila[1].match(/img\/club\/([0-9a-f]+)\//i);
      goleadores.push({
        nombre: capitalizar(textoPlano(nombre[1])),
        clubId: hex ? parseInt(hex[1], 16) : null,
        goles: Number(goles[1]),
      });
    }
  }

  return { ligaExterna, torneo, zonas, goleadores };
}

// ---------------------------------------------------------------------------
// Lectura con caché
// ---------------------------------------------------------------------------

const memoria = new Map<number, { at: number; data: LigaSnapshot }>();
const enCurso = new Map<number, Promise<LigaSnapshot>>();

export async function descargar(url: string, init?: RequestInit): Promise<string> {
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": USER_AGENT, ...(init?.headers || {}) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ahorafutbol.ar respondió ${res.status}`);
  return decodificarMixto(new Uint8Array(await res.arrayBuffer()));
}

async function leerDelSitio(ligaExterna: number): Promise<LigaSnapshot> {
  const html = await descargar(`${AHORAFUTBOL_URL}/ligas.php?i=${ligaExterna}&t=0`);
  const datos = parsearLiga(html, ligaExterna);
  if (datos.zonas.length === 0 && datos.goleadores.length === 0) {
    throw new Error("ahorafutbol.ar: la página no trae posiciones ni goleadores (¿cambió el formato?)");
  }
  return { ...datos, leido: new Date().toISOString() };
}

const claveCache = (liga: number) => `ahorafutbol:liga:${liga}`;

async function guardarCopia(data: LigaSnapshot) {
  const { error } = await supabase
    .from("fuente_externa_cache")
    .upsert({ clave: claveCache(data.ligaExterna), datos: data, actualizado: data.leido });
  if (error) console.warn("[ahorafutbol] no se pudo guardar la copia:", error.message);
}

async function leerCopia(liga: number): Promise<LigaSnapshot | null> {
  const { data, error } = await supabase
    .from("fuente_externa_cache")
    .select("datos")
    .eq("clave", claveCache(liga))
    .maybeSingle();
  if (error) return null;
  return (data?.datos as LigaSnapshot) ?? null;
}

/**
 * Posiciones y goleadores del torneo actual. Orden de preferencia: memoria
 * reciente → sitio → memoria vieja → copia en la base. Lanza error solo si no
 * hay ninguna.
 */
export async function obtenerLiga(ligaExterna = AHORAFUTBOL_LIGA_DEFAULT): Promise<LigaSnapshot> {
  const cache = memoria.get(ligaExterna);
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;

  let pendiente = enCurso.get(ligaExterna);
  if (!pendiente) {
    pendiente = (async () => {
      try {
        const data = await leerDelSitio(ligaExterna);
        memoria.set(ligaExterna, { at: Date.now(), data });
        await guardarCopia(data);
        return data;
      } catch (err) {
        console.error("[ahorafutbol]", err instanceof Error ? err.message : err);
        if (cache) {
          // Reintentar recién en 1 minuto para no insistir contra un sitio caído.
          memoria.set(ligaExterna, { at: Date.now() - TTL_MS + 60_000, data: cache.data });
          return cache.data;
        }
        const copia = await leerCopia(ligaExterna);
        if (copia) {
          memoria.set(ligaExterna, { at: Date.now() - TTL_MS + 60_000, data: copia });
          return copia;
        }
        throw err;
      } finally {
        enCurso.delete(ligaExterna);
      }
    })();
    enCurso.set(ligaExterna, pendiente);
  }
  return pendiente;
}

// ---------------------------------------------------------------------------
// Equivalencias con nuestras tablas
// ---------------------------------------------------------------------------

export type EquipoLocal = { id: string; nombre_equipo: string; logo_url: string | null; ahorafutbol_id?: number | null };

function normalizar(txt: string): string {
  return txt.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Busca nuestro equipo para un club del sitio: primero por `ahorafutbol_id`
 * (migración 006) y, si falta, por nombre parecido.
 */
export function crearBuscadorEquipos(equipos: EquipoLocal[]) {
  const porId = new Map<number, EquipoLocal>();
  for (const e of equipos) if (e.ahorafutbol_id) porId.set(Number(e.ahorafutbol_id), e);
  return (clubId: number | null, nombre?: string): EquipoLocal | undefined => {
    if (clubId != null && porId.has(clubId)) return porId.get(clubId);
    if (!nombre) return undefined;
    const n = normalizar(nombre);
    const exactos = equipos.filter((e) => normalizar(e.nombre_equipo) === n);
    if (exactos.length === 1) return exactos[0];
    const parciales = equipos.filter((e) => {
      const m = normalizar(e.nombre_equipo);
      return m.includes(n) || n.includes(m);
    });
    return parciales.length === 1 ? parciales[0] : undefined;
  };
}

/**
 * Liga del sitio para una liga nuestra: columna `ligas.ahorafutbol_id`
 * (migración 006); sin ella, la liga por defecto.
 */
export async function resolverLiga(ligaId?: string | null): Promise<{ ligaExterna: number; ligaId: string | null; nombre: string | null }> {
  const { data } = await supabase.from("ligas").select("*");
  const ligas = (data || []) as { id: string; nombre_liga: string; ahorafutbol_id?: number | null }[];
  const elegida = ligaId ? ligas.find((l) => l.id === ligaId) : ligas.find((l) => l.ahorafutbol_id) ?? (ligas.length === 1 ? ligas[0] : undefined);
  return {
    ligaExterna: Number(elegida?.ahorafutbol_id) || AHORAFUTBOL_LIGA_DEFAULT,
    ligaId: elegida?.id ?? null,
    nombre: elegida?.nombre_liga ?? null,
  };
}

export async function equiposDeLiga(ligaId: string | null): Promise<EquipoLocal[]> {
  let q = supabase.from("equipos").select("*");
  if (ligaId) q = q.eq("liga_id", ligaId);
  const { data } = await q;
  return (data || []) as EquipoLocal[];
}
