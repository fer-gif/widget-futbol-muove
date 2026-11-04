// Cliente de base de datos para los paneles (navegador).
// Imita la API encadenable de supabase-js, pero cada consulta viaja a
// /api/admin/db, donde el servidor valida la sesión y los permisos.
"use client";

type Filter = [string, string, unknown];
type Row = Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbResult = { data: any; error: { message: string } | null };

class AdminQuery implements PromiseLike<DbResult> {
  private spec: {
    table: string;
    op: "select" | "insert" | "update" | "delete" | "upsert";
    columns?: string;
    returning?: string;
    values?: Row | Row[];
    onConflict?: string;
    filters: Filter[];
    order: { col: string; asc: boolean }[];
    limit?: number;
    single?: "single" | "maybe";
  };

  constructor(table: string) {
    this.spec = { table, op: "select", filters: [], order: [] };
  }

  select(columns = "*") {
    if (this.spec.op === "select") this.spec.columns = columns;
    else this.spec.returning = columns;
    return this;
  }
  insert(values: Row | Row[]) {
    this.spec.op = "insert";
    this.spec.values = values;
    return this;
  }
  update(values: Row) {
    this.spec.op = "update";
    this.spec.values = values;
    return this;
  }
  upsert(values: Row | Row[], opts?: { onConflict?: string }) {
    this.spec.op = "upsert";
    this.spec.values = values;
    this.spec.onConflict = opts?.onConflict;
    return this;
  }
  delete() {
    this.spec.op = "delete";
    return this;
  }

  private filter(method: string, col: string, val: unknown) {
    this.spec.filters.push([method, col, val]);
    return this;
  }
  eq(col: string, val: unknown) { return this.filter("eq", col, val); }
  neq(col: string, val: unknown) { return this.filter("neq", col, val); }
  is(col: string, val: unknown) { return this.filter("is", col, val); }
  in(col: string, val: unknown[]) { return this.filter("in", col, val); }
  gt(col: string, val: unknown) { return this.filter("gt", col, val); }
  gte(col: string, val: unknown) { return this.filter("gte", col, val); }
  lt(col: string, val: unknown) { return this.filter("lt", col, val); }
  lte(col: string, val: unknown) { return this.filter("lte", col, val); }

  order(col: string, opts?: { ascending?: boolean }) {
    this.spec.order.push({ col, asc: opts?.ascending !== false });
    return this;
  }
  limit(n: number) {
    this.spec.limit = n;
    return this;
  }
  single() {
    this.spec.single = "single";
    return this;
  }
  maybeSingle() {
    this.spec.single = "maybe";
    return this;
  }

  then<T1 = DbResult, T2 = never>(
    onfulfilled?: ((value: DbResult) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null
  ): PromiseLike<T1 | T2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<DbResult> {
    try {
      const res = await fetch("/api/admin/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this.spec),
      });
      if (res.status === 401) {
        // Sesión vencida: recargar muestra el formulario de login.
        window.location.reload();
        return { data: null, error: { message: "Sesión vencida" } };
      }
      const json = await res.json().catch(() => null);
      if (!json) return { data: null, error: { message: `Error ${res.status}` } };
      return { data: json.data ?? null, error: json.error ? { message: json.error } : null };
    } catch (err) {
      return { data: null, error: { message: err instanceof Error ? err.message : "Error de red" } };
    }
  }
}

export const db = {
  from: (table: string) => new AdminQuery(table),
};

/** Sube una imagen al bucket de logos a través del servidor y devuelve su URL pública. */
export async function uploadImage(file: File, folder: "logos" | "sponsors"): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);
  const res = await fetch("/api/admin/upload", { method: "POST", body: form });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || "No se pudo subir la imagen.");
  }
  return json.url as string;
}

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.reload();
}
