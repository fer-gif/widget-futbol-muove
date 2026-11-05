// Carga puntual de fixture y resultados desde ahorafutbol.ar hacia `partidos`.
// Se usa a mano desde el super-admin para ponerse al día; la carga habitual la
// siguen haciendo los diarios.
//
// Reglas:
// - Partido ya jugado con resultado en el sitio: finalizado con ese resultado,
//   aunque el sitio lo marque como postergado (pasa con los dados por ganado).
// - Antes del partido: se actualizan fecha, hora, jornada y estado (postergado o
//   suspendido sin resultado → "suspendido").
// - Durante el partido (inicio → +130 min): si el periodista lo está siguiendo
//   (estado en_vivo o reloj iniciado) no se toca. Si no, se copia el marcador del
//   sitio, sin bajar nunca la cantidad de goles ya cargada.
// - Después: el resultado del sitio cierra el partido como finalizado.
// - Los partidos cargados a mano se vinculan por equipos y fecha cercana, en vez
//   de duplicarse.
// Solo servidor (service role).
import { supabase } from "@/lib/supabase-server";
import { LIVE_WINDOW_MIN } from "@/lib/match-clock";
import {
  AHORAFUTBOL_URL,
  crearBuscadorEquipos,
  descargar,
  equiposDeLiga,
  leerLiga,
  normalizar,
  resolverLiga,
  textoPlano,
  type EquipoLocal,
} from "@/lib/ahorafutbol";

export type PartidoSitio = {
  id: number;
  localId: number;
  local: string;
  golesLocal: number | null;
  visitanteId: number;
  visitante: string;
  golesVisitante: number | null;
  jornada: string;
  /** ISO con zona -03:00 */
  fechaHora: string;
  /** 0 normal, 1 postergado, 2 suspendido */
  estado: number;
  torneo: string;
};

export type ResumenSync = {
  liga: string;
  /** true: se calcularon los cambios sin escribir nada. */
  simulado: boolean;
  modo: "reciente" | "completo";
  consultas: number;
  recibidos: number;
  creados: number;
  actualizados: number;
  vinculados: number;
  sinCambios: number;
  omitidos: { partido: string; motivo: string }[];
  /** Partidos nuestros del período que el sitio no tiene (posibles duplicados o mal cargados). */
  sinPareja: string[];
  /** Solo en modo completo: goleadores traídos del sitio. */
  goleadores: { nuevos: number; actualizados: number; sinCambios: number; sinEquipo: number } | null;
  /** Solo en modo completo: equipos sin zona a los que se les asignó la del sitio. */
  zonas: number;
};

const DIA_MS = 864e5;
const PAUSA_MS = 300;
const MAX_CONSULTAS = 90;
// Días que se consultan a la vez (la función de Vercel corta a los 60 s).
const EN_PARALELO = 4;

// ---------------------------------------------------------------------------
// Lectura de db/partido.php (un día por consulta)
// ---------------------------------------------------------------------------

/**
 * Errores conocidos del sitio, por número de partido. Solo se aplican si el
 * sitio todavía tiene el dato equivocado (si lo corrigen, no hacen nada).
 */
const CORRECCIONES: Record<number, { si: Partial<PartidoSitio>; poner: Partial<PartidoSitio> }> = {
  // Fecha 14 (23/08): Villa Díaz Vélez 1-0 Defensores de Puerto Quequén. El sitio
  // pone Defensores J.N.F., que así suma 22 partidos y Puerto Quequén 20.
  8342: { si: { visitanteId: 16 }, poner: { visitanteId: 15, visitante: "Defensores Puerto Quequén" } },
};

function corregir(p: PartidoSitio): PartidoSitio {
  const c = CORRECCIONES[p.id];
  if (!c) return p;
  const aplica = Object.entries(c.si).every(([k, v]) => p[k as keyof PartidoSitio] === v);
  return aplica ? { ...p, ...c.poner } : p;
}

function entero(v: string | undefined): number | null {
  if (v == null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Formato: `fecha^dias^torneos^partidosT1^...^partidosTn^clubes^idsTorneos`.
 * Cada partido: `idL|local|golesL|penL|idV|visitante|golesV|penV|jornada|fechaHora|estado|árbitro|cancha|id`.
 */
export function parsearDia(texto: string): { fecha: string; dias: string[]; partidos: PartidoSitio[] } {
  const info = texto.split("^");
  const fecha = (info[0] || "").trim();
  const dias = (info[1] || "")
    .split("|")
    .map((d) => d.trim().split(" ").pop() || "")
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  const torneos = (info[2] || "").split("#");
  const partidos: PartidoSitio[] = [];
  torneos.forEach((torneo, j) => {
    for (const crudo of (info[3 + j] || "").split("#")) {
      const d = crudo.split("|");
      if (d.length < 14) continue;
      const id = entero(d[13]);
      const localId = entero(d[0]);
      const visitanteId = entero(d[4]);
      const m = (d[9] || "").match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
      if (!id || !localId || !visitanteId || !m) continue;
      partidos.push(corregir({
        id,
        localId,
        local: textoPlano(d[1]),
        golesLocal: entero(d[2]),
        visitanteId,
        visitante: textoPlano(d[5]),
        golesVisitante: entero(d[6]),
        jornada: textoPlano(d[8]),
        fechaHora: `${m[1]}T${m[2]}:00-03:00`,
        estado: entero(d[10]) ?? 0,
        torneo: textoPlano(torneo),
      }));
    }
  });
  return { fecha, dias, partidos };
}

async function leerDia(ligaExterna: number, fecha: string) {
  const texto = await descargar(`${AHORAFUTBOL_URL}/db/partido.php`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ z: "10", a: String(ligaExterna), b: fecha }).toString(),
  });
  return parsearDia(texto);
}

const normalizarJornada = (j: string | null | undefined) => (j || "").toLowerCase().replace(/\s+/g, " ").trim();
const hoyAR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Recorre los días con partidos. "reciente": 21 días para atrás y para adelante.
 * "completo": desde el 1 de enero del año en curso.
 */
async function recolectar(ligaExterna: number, modo: "reciente" | "completo") {
  const hoy = hoyAR();
  const desde =
    modo === "completo" ? `${hoy.slice(0, 4)}-01-01` : new Date(Date.now() - 21 * DIA_MS).toISOString().slice(0, 10);
  const hasta = new Date(Date.now() + 21 * DIA_MS).toISOString().slice(0, 10);

  const pendientes = [hoy];
  const consultados = new Set<string>();
  const vistos = new Set<string>();
  const partidos = new Map<number, PartidoSitio>();
  let consultas = 0;

  while (pendientes.length && consultas < MAX_CONSULTAS) {
    // Tanda de hasta EN_PARALELO días todavía no consultados.
    const tanda: string[] = [];
    while (pendientes.length && tanda.length < EN_PARALELO && consultas + tanda.length < MAX_CONSULTAS) {
      const dia = pendientes.shift()!;
      if (consultados.has(dia)) continue;
      consultados.add(dia);
      tanda.push(dia);
    }
    if (tanda.length === 0) break;
    if (consultas > 0) await pausa(PAUSA_MS);
    consultas += tanda.length;
    const respuestas = await Promise.all(tanda.map((dia) => leerDia(ligaExterna, dia)));
    for (const r of respuestas) {
      if (r.fecha) consultados.add(r.fecha);
      for (const p of r.partidos) partidos.set(p.id, p);
      for (const d of r.dias) {
        if (d < desde || d > hasta || vistos.has(d)) continue;
        vistos.add(d);
        if (!consultados.has(d)) pendientes.push(d);
      }
    }
  }
  return { partidos: [...partidos.values()], consultas, desde };
}

// ---------------------------------------------------------------------------
// Volcado a nuestra base
// ---------------------------------------------------------------------------

type PartidoLocal = {
  id: string;
  equipo_local_id: string;
  equipo_visitante_id: string;
  goles_local: number;
  goles_visitante: number;
  estado_partido: string;
  fecha_hora: string;
  jornada: string | null;
  periodo: string | null;
  ahorafutbol_id: number | null;
};

/** Campos que corresponde escribir según las reglas del encabezado. */
function camposDeseados(s: PartidoSitio, nuestro: PartidoLocal | undefined, ahora: number) {
  const inicio = Date.parse(s.fechaHora);
  const fin = inicio + LIVE_WINDOW_MIN * 60e3;
  const tieneMarcador = s.golesLocal != null && s.golesVisitante != null;
  const campos: Partial<PartidoLocal> = { fecha_hora: new Date(inicio).toISOString(), jornada: s.jornada || null };

  const enManos = nuestro && ahora < fin && ahora >= inicio - 30 * 60e3 && (nuestro.estado_partido === "en_vivo" || nuestro.periodo);
  if (enManos) return campos; // el periodista lo está siguiendo

  if (tieneMarcador && ahora >= fin) {
    campos.estado_partido = "finalizado";
    campos.goles_local = s.golesLocal!;
    campos.goles_visitante = s.golesVisitante!;
  } else if (s.estado === 1 || s.estado === 2) {
    campos.estado_partido = "suspendido";
  } else if (tieneMarcador && ahora >= inicio) {
    const total = s.golesLocal! + s.golesVisitante!;
    const nuestroTotal = nuestro ? nuestro.goles_local + nuestro.goles_visitante : 0;
    if (!nuestro || (nuestro.estado_partido !== "finalizado" && total >= nuestroTotal)) {
      campos.goles_local = s.golesLocal!;
      campos.goles_visitante = s.golesVisitante!;
    }
  } else if (ahora < inicio) {
    if (!nuestro || nuestro.estado_partido !== "finalizado") campos.estado_partido = "programado";
  }
  return campos;
}

export async function sincronizarPartidos(
  opciones: { ligaId?: string | null; modo?: "reciente" | "completo"; simular?: boolean } = {}
): Promise<ResumenSync> {
  const modo = opciones.modo ?? "reciente";
  const simular = Boolean(opciones.simular);
  const liga = await resolverLiga(opciones.ligaId);
  if (!liga.ligaId) throw new Error("No hay una liga vinculada a ahorafutbol.ar.");

  const COLS = "id, equipo_local_id, equipo_visitante_id, goles_local, goles_visitante, estado_partido, fecha_hora, jornada, periodo";
  const r1 = await supabase.from("partidos").select(`${COLS}, ahorafutbol_id`).eq("liga_id", liga.ligaId);
  let existentes = r1.data as PartidoLocal[] | null;
  let error = r1.error;
  if (error && simular) {
    // Simulación antes de las migraciones 004/006: las columnas que falten quedan vacías.
    const r2 = await supabase.from("partidos").select("*").eq("liga_id", liga.ligaId);
    existentes = r2.data as PartidoLocal[] | null;
    error = r2.error;
  }
  if (error) {
    throw new Error(
      /ahorafutbol_id|periodo/.test(error.message)
        ? "Falta correr las migraciones 004 y 006 en Supabase."
        : error.message
    );
  }

  const equipos = await equiposDeLiga(liga.ligaId);
  const buscar = crearBuscadorEquipos(equipos);
  const { partidos, consultas, desde } = await recolectar(liga.ligaExterna, modo);

  const nuestros = existentes || [];
  const porExterno = new Map<number, PartidoLocal>();
  for (const p of nuestros) if (p.ahorafutbol_id) porExterno.set(Number(p.ahorafutbol_id), p);
  const usados = new Set<string>(nuestros.filter((p) => p.ahorafutbol_id).map((p) => p.id));

  const resumen: ResumenSync = {
    liga: liga.nombre || "",
    simulado: simular,
    modo,
    consultas,
    recibidos: partidos.length,
    creados: 0,
    actualizados: 0,
    vinculados: 0,
    sinCambios: 0,
    omitidos: [],
    sinPareja: [],
    goleadores: null,
    zonas: 0,
  };
  const ahora = Date.now();
  // Se escriben al final, en tandas, para no hacer una consulta por partido.
  const nuevos: { fila: Record<string, unknown>; nombre: string }[] = [];
  const updates: { id: string; cambios: Record<string, unknown>; nombre: string; vincular: boolean }[] = [];

  for (const s of partidos.sort((a, b) => a.fechaHora.localeCompare(b.fechaHora))) {
    const nombre = `${s.local} vs ${s.visitante} (${s.fechaHora.slice(0, 10)})`;
    const local = buscar(s.localId, s.local);
    const visitante = buscar(s.visitanteId, s.visitante);
    if (!local || !visitante) {
      resumen.omitidos.push({ partido: nombre, motivo: `No encuentro el equipo ${!local ? s.local : s.visitante} en la base` });
      continue;
    }

    let nuestro = porExterno.get(s.id);
    let vincular = false;
    if (!nuestro) {
      // Partido cargado a mano: mismos equipos y, o bien fecha a 4 días o menos,
      // o bien la misma jornada ("Fecha 8") aunque el día no coincida.
      const inicio = Date.parse(s.fechaHora);
      const jornada = normalizarJornada(s.jornada);
      nuestro = nuestros
        .filter((p) => !usados.has(p.id) && p.equipo_local_id === local.id && p.equipo_visitante_id === visitante.id)
        .map((p) => ({ p, dif: Math.abs(Date.parse(p.fecha_hora) - inicio) }))
        .filter((x) => x.dif <= 4 * DIA_MS || (jornada !== "" && normalizarJornada(x.p.jornada) === jornada))
        .sort((a, b) => a.dif - b.dif)[0]?.p;
      if (nuestro) {
        usados.add(nuestro.id);
        vincular = true;
      }
    }

    const campos = camposDeseados(s, nuestro, ahora);

    if (!nuestro) {
      if (simular) {
        resumen.creados++;
        continue;
      }
      nuevos.push({
        nombre,
        fila: {
          liga_id: liga.ligaId,
          cliente_id: null,
          equipo_local_id: local.id,
          equipo_visitante_id: visitante.id,
          goles_local: campos.goles_local ?? 0,
          goles_visitante: campos.goles_visitante ?? 0,
          estado_partido: campos.estado_partido ?? "programado",
          fecha_hora: campos.fecha_hora,
          jornada: campos.jornada,
          ahorafutbol_id: s.id,
        },
      });
      continue;
    }

    const cambios: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(campos)) {
      const actual = nuestro[k as keyof PartidoLocal];
      const igual = k === "fecha_hora" ? Date.parse(String(actual)) === Date.parse(String(v)) : actual === v;
      if (!igual) cambios[k] = v;
    }
    if (vincular) cambios.ahorafutbol_id = s.id;
    if (Object.keys(cambios).length === 0) {
      resumen.sinCambios++;
      continue;
    }
    if (simular) {
      if (vincular) resumen.vinculados++;
      else resumen.actualizados++;
      continue;
    }
    updates.push({ id: nuestro.id, cambios, nombre, vincular });
  }

  // Altas: de a 100 por consulta. Si una tanda falla, se reintenta de a uno
  // para saber cuál fue.
  for (let i = 0; i < nuevos.length; i += 100) {
    const tanda = nuevos.slice(i, i + 100);
    const { error: errTanda } = await supabase.from("partidos").insert(tanda.map((n) => n.fila));
    if (!errTanda) {
      resumen.creados += tanda.length;
      continue;
    }
    for (const n of tanda) {
      const { error: errIns } = await supabase.from("partidos").insert(n.fila);
      if (errIns) resumen.omitidos.push({ partido: n.nombre, motivo: errIns.message });
      else resumen.creados++;
    }
  }

  // Cambios: de a 10 en paralelo.
  for (let i = 0; i < updates.length; i += 10) {
    const tanda = updates.slice(i, i + 10);
    const res = await Promise.all(tanda.map((u) => supabase.from("partidos").update(u.cambios).eq("id", u.id)));
    res.forEach(({ error: errUpd }, k) => {
      const u = tanda[k];
      if (errUpd) resumen.omitidos.push({ partido: u.nombre, motivo: errUpd.message });
      else if (u.vincular) resumen.vinculados++;
      else resumen.actualizados++;
    });
  }

  if (modo === "completo") {
    const nombre = new Map(equipos.map((e) => [e.id, e.nombre_equipo]));
    resumen.sinPareja = nuestros
      .filter((p) => !usados.has(p.id) && p.fecha_hora.slice(0, 10) >= desde)
      .sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora))
      .map((p) => `${nombre.get(p.equipo_local_id) ?? "?"} vs ${nombre.get(p.equipo_visitante_id) ?? "?"} (${p.fecha_hora.slice(0, 10)}, ${p.jornada ?? "sin jornada"})`);
  }

  if (modo === "completo") {
    const extra = await importarGoleadoresYZonas(liga.ligaId, liga.ligaExterna, equipos, simular);
    resumen.goleadores = extra.goleadores;
    resumen.zonas = extra.zonas;
  }

  return resumen;
}

// ---------------------------------------------------------------------------
// Goleadores y zonas (modo completo)
// ---------------------------------------------------------------------------

async function importarGoleadoresYZonas(ligaId: string, ligaExterna: number, equipos: EquipoLocal[], simular: boolean) {
  const datos = await leerLiga(ligaExterna);
  const buscar = crearBuscadorEquipos(equipos);

  // Zonas: solo a equipos que todavía no tienen (no se pisa lo cargado a mano).
  let zonas = 0;
  if (datos.zonas.length > 1) {
    for (const z of datos.zonas) {
      for (const f of z.filas) {
        const eq = buscar(f.clubId, f.nombre);
        if (!eq || eq.zona) continue;
        zonas++;
        if (!simular) await supabase.from("equipos").update({ zona: z.zona }).eq("id", eq.id);
      }
    }
  }

  // Goleadores: se suman los nuevos y se pone al día la cantidad de goles.
  const { data: actuales, error } = await supabase.from("goleadores").select("id, nombre, equipo_id, goles").eq("liga_id", ligaId);
  if (error && !simular) throw new Error("Falta correr la migración 006 en Supabase (tabla goleadores).");
  const clave = (nombre: string, equipoId: string | null | undefined) => `${normalizar(nombre)}|${equipoId ?? ""}`;
  const existentes = new Map((actuales || []).map((g) => [clave(g.nombre, g.equipo_id), g]));
  const nombresSitio = new Map<number, string>();
  for (const z of datos.zonas) for (const f of z.filas) nombresSitio.set(f.clubId, f.nombre);

  const resumen = { nuevos: 0, actualizados: 0, sinCambios: 0, sinEquipo: 0 };
  const nuevos: { liga_id: string; equipo_id: string | null; nombre: string; goles: number }[] = [];
  const ahora = new Date().toISOString();
  for (const g of datos.goleadores) {
    const eq = buscar(g.clubId, g.clubId != null ? nombresSitio.get(g.clubId) : undefined);
    if (!eq) resumen.sinEquipo++;
    const ex = existentes.get(clave(g.nombre, eq?.id));
    if (!ex) {
      resumen.nuevos++;
      nuevos.push({ liga_id: ligaId, equipo_id: eq?.id ?? null, nombre: g.nombre, goles: g.goles });
    } else if (ex.goles !== g.goles) {
      resumen.actualizados++;
      if (!simular) await supabase.from("goleadores").update({ goles: g.goles, actualizado: ahora }).eq("id", ex.id);
    } else {
      resumen.sinCambios++;
    }
  }
  if (!simular && nuevos.length) {
    const { error: errIns } = await supabase.from("goleadores").insert(nuevos);
    if (errIns) throw new Error(`No se pudieron guardar los goleadores: ${errIns.message}`);
  }
  return { goleadores: resumen, zonas };
}
