// Proxy de base de datos para los paneles de administración.
// El navegador describe la consulta (tabla, operación, filtros) y el servidor
// la ejecuta con la service role key SOLO si la sesión tiene permiso.
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { hashSecret, requireRole, type Session } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Op = "select" | "insert" | "update" | "delete" | "upsert";
type FilterMethod = "eq" | "neq" | "is" | "in" | "gt" | "gte" | "lt" | "lte";
type Filter = [FilterMethod, string, unknown];
type Row = Record<string, unknown>;

type QuerySpec = {
  table: string;
  op: Op;
  columns?: string;
  returning?: string | null;
  values?: Row | Row[];
  onConflict?: string;
  filters?: Filter[];
  order?: { col: string; asc?: boolean }[];
  limit?: number;
  single?: "single" | "maybe";
};

const SUPERADMIN_TABLES = new Set([
  "clientes",
  "ligas",
  "equipos",
  "partidos",
  "clientes_ligas",
  "configuracion_widgets",
  "noticias",
  "tablas_posiciones",
  "goleadores",
]);

// Columnas de partidos que un periodista puede escribir.
const PERIODISTA_PARTIDO_COLS = new Set([
  "liga_id",
  "equipo_local_id",
  "equipo_visitante_id",
  "goles_local",
  "goles_visitante",
  "estado_partido",
  "minuto_actual",
  "periodo",
  "periodo_inicio",
  "jornada",
  "fecha_hora",
  "cliente_id",
]);

// Columnas de goleadores que un periodista puede escribir.
const PERIODISTA_GOLEADOR_COLS = new Set(["liga_id", "equipo_id", "nombre", "goles", "actualizado"]);

const FILTER_METHODS = new Set<FilterMethod>(["eq", "neq", "is", "in", "gt", "gte", "lt", "lte"]);
const IDENT = /^[a-z_][a-z0-9_]*$/;
const COLUMNS = /^[a-zA-Z0-9_,\s*():!.]+$/;

class Forbidden extends Error {}
class BadRequest extends Error {}

function asRows(values: QuerySpec["values"]): Row[] {
  if (!values) return [];
  return Array.isArray(values) ? values : [values];
}

function idFilter(spec: QuerySpec): string | null {
  const f = (spec.filters || []).find(([m, c]) => m === "eq" && c === "id");
  return f ? String(f[2]) : null;
}

async function periodistaLigas(clienteId: string): Promise<Set<string> | null> {
  const { data } = await supabase.from("clientes_ligas").select("liga_id").eq("cliente_id", clienteId);
  // Sin asignaciones explícitas = todas las ligas (mismo criterio que el widget).
  if (!data || data.length === 0) return null;
  return new Set(data.map((r) => r.liga_id as string));
}

async function authorizePeriodista(spec: QuerySpec, session: Session): Promise<QuerySpec> {
  const clienteId = session.clienteId!;

  if (spec.op === "select") {
    if (spec.table === "ligas" || spec.table === "equipos" || spec.table === "partidos" || spec.table === "goleadores") {
      // Solo las ligas asignadas a su medio (si tiene asignaciones).
      const ligas = await periodistaLigas(clienteId);
      if (!ligas) return spec;
      const col = spec.table === "ligas" ? "id" : "liga_id";
      return { ...spec, filters: [...(spec.filters || []), ["in", col, [...ligas]]] };
    }
    if (spec.table === "clientes") {
      // Solo puede ver su propio medio, sin datos sensibles.
      return {
        ...spec,
        columns: "id, nombre_medio",
        filters: [...(spec.filters || []), ["eq", "id", clienteId]],
      };
    }
    throw new Forbidden(`Sin acceso de lectura a ${spec.table}`);
  }

  if ((spec.table !== "partidos" && spec.table !== "goleadores") || spec.op === "upsert") {
    throw new Forbidden(`Sin acceso de escritura a ${spec.table}`);
  }

  const ligas = await periodistaLigas(clienteId);
  const ligaOk = (id: unknown) => !ligas || ligas.has(String(id));

  if (spec.table === "goleadores") {
    // Goleadores de la liga: los edita cualquier medio suscripto a ella.
    const checkGoleador = (row: Row) => {
      for (const k of Object.keys(row)) {
        if (!PERIODISTA_GOLEADOR_COLS.has(k)) throw new Forbidden(`No podés modificar el campo ${k}`);
      }
      if ("liga_id" in row && !ligaOk(row.liga_id)) throw new Forbidden("Liga no habilitada para tu medio");
    };
    if (spec.op === "insert") {
      for (const row of asRows(spec.values)) {
        if (!row.liga_id) throw new BadRequest("liga_id es obligatorio");
        checkGoleador(row);
      }
      return spec;
    }
    const gid = idFilter(spec);
    if (!gid) throw new BadRequest("Se requiere filtrar por id");
    const { data: goleador } = await supabase.from("goleadores").select("liga_id").eq("id", gid).maybeSingle();
    if (!goleador) throw new BadRequest("Goleador no encontrado");
    if (!ligaOk(goleador.liga_id)) throw new Forbidden("Este goleador no es de una liga de tu medio");
    if (spec.op === "update") asRows(spec.values).forEach(checkGoleador);
    return { ...spec, filters: [["eq", "id", gid]] };
  }

  const destinoOk = (id: unknown) => id === null || id === undefined || id === clienteId;

  const checkValues = (row: Row) => {
    for (const k of Object.keys(row)) {
      if (!PERIODISTA_PARTIDO_COLS.has(k)) throw new Forbidden(`No podés modificar el campo ${k}`);
    }
    if ("liga_id" in row && !ligaOk(row.liga_id)) throw new Forbidden("Liga no habilitada para tu medio");
    if ("cliente_id" in row && !destinoOk(row.cliente_id)) {
      throw new Forbidden("Solo podés asignar partidos a tu medio o a todos");
    }
  };

  if (spec.op === "insert") {
    for (const row of asRows(spec.values)) {
      if (!row.liga_id) throw new BadRequest("liga_id es obligatorio");
      checkValues(row);
    }
    return spec;
  }

  // update / delete: exigen un id concreto y validan el partido existente.
  const id = idFilter(spec);
  if (!id) throw new BadRequest("Se requiere filtrar por id");
  const { data: partido } = await supabase
    .from("partidos")
    .select("liga_id, cliente_id")
    .eq("id", id)
    .maybeSingle();
  if (!partido) throw new BadRequest("Partido no encontrado");
  if (!ligaOk(partido.liga_id) || !destinoOk(partido.cliente_id)) {
    throw new Forbidden("Este partido no pertenece a tu medio");
  }
  if (spec.op === "update") asRows(spec.values).forEach(checkValues);
  return { ...spec, filters: [["eq", "id", id]] };
}

/** Transforma la clave de periodista en hash antes de guardarla. */
function protectClienteSecrets(row: Row): Row {
  const out = { ...row };
  delete out.clave_hash;
  if ("clave_periodista" in out) {
    const plain = String(out.clave_periodista ?? "").trim();
    delete out.clave_periodista;
    if (plain) {
      out.clave_hash = hashSecret(plain);
      out.clave_periodista = null;
    }
  }
  return out;
}

function stripClienteSecrets(data: unknown): unknown {
  const clean = (r: Row) => {
    const { clave_hash, clave_periodista, ...rest } = r;
    return { ...rest, tiene_clave: Boolean(clave_hash || clave_periodista) };
  };
  if (Array.isArray(data)) return data.map((r) => clean(r as Row));
  if (data && typeof data === "object") return clean(data as Row);
  return data;
}

function validate(spec: QuerySpec) {
  if (!spec || typeof spec.table !== "string" || !IDENT.test(spec.table)) throw new BadRequest("Tabla inválida");
  if (!["select", "insert", "update", "delete", "upsert"].includes(spec.op)) throw new BadRequest("Operación inválida");
  if (spec.columns && !COLUMNS.test(spec.columns)) throw new BadRequest("Columnas inválidas");
  if (spec.returning && !COLUMNS.test(spec.returning)) throw new BadRequest("Columnas inválidas");
  for (const f of spec.filters || []) {
    if (!Array.isArray(f) || !FILTER_METHODS.has(f[0]) || !IDENT.test(String(f[1]))) {
      throw new BadRequest("Filtro inválido");
    }
  }
  for (const o of spec.order || []) {
    if (!IDENT.test(String(o.col))) throw new BadRequest("Orden inválido");
  }
  if ((spec.op === "update" || spec.op === "delete") && !(spec.filters || []).length) {
    throw new BadRequest("Las operaciones masivas sin filtro no están permitidas");
  }
  if (spec.onConflict && !/^[a-z_,]+$/.test(spec.onConflict)) throw new BadRequest("onConflict inválido");
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(["superadmin", "periodista"]);
  if (auth.error) return auth.error;
  const { session } = auth;

  try {
    let spec = (await req.json()) as QuerySpec;
    validate(spec);

    if (session.role === "periodista") {
      spec = await authorizePeriodista(spec, session);
    } else if (!SUPERADMIN_TABLES.has(spec.table)) {
      throw new Forbidden(`Tabla no permitida: ${spec.table}`);
    }

    if (spec.table === "clientes" && spec.values) {
      spec.values = Array.isArray(spec.values)
        ? spec.values.map(protectClienteSecrets)
        : protectClienteSecrets(spec.values);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase.from(spec.table);
    switch (spec.op) {
      case "select":
        q = q.select(spec.columns || "*");
        break;
      case "insert":
        q = q.insert(spec.values);
        break;
      case "update":
        q = q.update(spec.values);
        break;
      case "upsert":
        q = q.upsert(spec.values, spec.onConflict ? { onConflict: spec.onConflict } : undefined);
        break;
      case "delete":
        q = q.delete();
        break;
    }
    if (spec.op !== "select" && spec.returning) q = q.select(spec.returning);
    for (const [method, col, val] of spec.filters || []) q = q[method](col, val);
    for (const o of spec.order || []) q = q.order(o.col, { ascending: o.asc !== false });
    if (spec.limit) q = q.limit(Math.min(Number(spec.limit) || 1, 5000));
    if (spec.single === "single") q = q.single();
    if (spec.single === "maybe") q = q.maybeSingle();

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ data: null, error: error.message }, { status: 400 });
    }
    return NextResponse.json({
      data: spec.table === "clientes" ? stripClienteSecrets(data) : data,
      error: null,
    });
  } catch (err) {
    const status = err instanceof Forbidden ? 403 : err instanceof BadRequest ? 400 : 500;
    if (status === 500) console.error("[admin/db]", err);
    return NextResponse.json(
      { data: null, error: err instanceof Error ? err.message : "Error del servidor" },
      { status }
    );
  }
}
