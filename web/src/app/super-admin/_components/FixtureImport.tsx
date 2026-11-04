"use client";

// Importación masiva del fixture desde un CSV (o pegado desde Excel / Google Sheets).
import { useMemo, useState } from "react";
import { db } from "@/lib/db-client";
import { toast } from "@/components/Toaster";

type Equipo = { id: string; nombre_equipo: string; liga_id: string };
type Props = {
  ligas: { id: string; nombre_liga: string }[];
  equipos: Equipo[];
  clientes: { id: string; nombre_medio: string }[];
  partidos: { liga_id: string; equipo_local_id: string; equipo_visitante_id: string; fecha_hora?: string | null }[];
  onImported: () => void;
};

type Fila = {
  linea: number;
  texto: string;
  fechaHora: string | null;
  local?: Equipo;
  visitante?: Equipo;
  jornada: string | null;
  error: string | null;
  duplicado: boolean;
};

const EJEMPLO = `fecha;hora;local;visitante;jornada
15/03/2027;16:00;Mataderos;Ministerio;Fecha 1
15/03/2027;16:00;Rivadavia;Newbery;Fecha 1`;

const normalizar = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(club|c\.?a\.?|atletico|deportivo)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Busca el equipo por nombre: primero exacto, después por coincidencia parcial única. */
function buscarEquipo(nombre: string, equipos: Equipo[]): Equipo | undefined {
  const n = normalizar(nombre);
  if (!n) return undefined;
  const exacto = equipos.find((e) => normalizar(e.nombre_equipo) === n);
  if (exacto) return exacto;
  const parciales = equipos.filter((e) => {
    const en = normalizar(e.nombre_equipo);
    return en.includes(n) || n.includes(en);
  });
  return parciales.length === 1 ? parciales[0] : undefined;
}

/** "15/03/2027" o "2027-03-15" + "16:00" → ISO en hora argentina (UTC-3). */
function parseFechaHora(fecha: string, hora: string): string | null {
  let y: number, m: number, d: number;
  const dmy = fecha.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  const ymd = fecha.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (dmy) {
    [d, m, y] = [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])];
    if (y < 100) y += 2000;
  } else if (ymd) {
    [y, m, d] = [Number(ymd[1]), Number(ymd[2]), Number(ymd[3])];
  } else return null;
  const hm = (hora || "").match(/^(\d{1,2})[:.](\d{2})/);
  if (!hm) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = `${y}-${pad(m)}-${pad(d)}T${pad(Number(hm[1]))}:${hm[2]}:00-03:00`;
  const t = new Date(iso);
  if (isNaN(t.getTime()) || t.getUTCMonth() + 1 !== m) return null; // descarta 31/02, etc.
  return t.toISOString();
}

function separarLinea(linea: string, sep: string): string[] {
  const out: string[] = [];
  let actual = "";
  let comillas = false;
  for (const ch of linea) {
    if (ch === '"') comillas = !comillas;
    else if (ch === sep && !comillas) {
      out.push(actual.trim());
      actual = "";
    } else actual += ch;
  }
  out.push(actual.trim());
  return out;
}

export default function FixtureImport({ ligas, equipos, clientes, partidos, onImported }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [ligaId, setLigaId] = useState("");
  const [destino, setDestino] = useState("");
  const [texto, setTexto] = useState("");
  const [importando, setImportando] = useState(false);

  const filas = useMemo<Fila[]>(() => {
    if (!ligaId || !texto.trim()) return [];
    const equiposLiga = equipos.filter((e) => e.liga_id === ligaId);
    const lineas = texto.replace(/\r/g, "").split("\n");
    const primera = lineas.find((l) => l.trim()) || "";
    const sep = primera.includes("\t") ? "\t" : primera.split(";").length > primera.split(",").length ? ";" : ",";

    const existentes = new Set(
      partidos
        .filter((p) => p.liga_id === ligaId)
        .map((p) => `${p.equipo_local_id}|${p.equipo_visitante_id}|${(p.fecha_hora || "").slice(0, 10)}`)
    );

    const out: Fila[] = [];
    lineas.forEach((raw, idx) => {
      if (!raw.trim()) return;
      const cols = separarLinea(raw, sep);
      if (idx === lineas.indexOf(primera) && /fecha/i.test(cols[0] || "")) return; // encabezado
      const [fecha = "", hora = "", loc = "", vis = "", jornada = ""] = cols;
      const local = buscarEquipo(loc, equiposLiga);
      const visitante = buscarEquipo(vis, equiposLiga);
      const fechaHora = parseFechaHora(fecha, hora);

      let error: string | null = null;
      if (cols.length < 4) error = "Faltan columnas (fecha; hora; local; visitante)";
      else if (!fechaHora) error = `Fecha u hora inválida: "${fecha} ${hora}"`;
      else if (!local) error = `No encuentro el equipo local "${loc}" en esta liga`;
      else if (!visitante) error = `No encuentro el equipo visitante "${vis}" en esta liga`;
      else if (local.id === visitante.id) error = "Local y visitante son el mismo equipo";

      const duplicado =
        !error && existentes.has(`${local!.id}|${visitante!.id}|${fechaHora!.slice(0, 10)}`);

      out.push({ linea: idx + 1, texto: raw, fechaHora, local, visitante, jornada: jornada || null, error, duplicado });
    });
    return out;
  }, [ligaId, texto, equipos, partidos]);

  const validas = filas.filter((f) => !f.error && !f.duplicado);

  async function onArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500_000) return toast.error("El archivo es demasiado grande (máximo 500 KB).");
    setTexto(await file.text());
  }

  async function importar() {
    if (validas.length === 0) return;
    setImportando(true);
    const { error } = await db.from("partidos").insert(
      validas.map((f) => ({
        liga_id: ligaId,
        equipo_local_id: f.local!.id,
        equipo_visitante_id: f.visitante!.id,
        fecha_hora: f.fechaHora,
        jornada: f.jornada,
        estado_partido: "programado",
        cliente_id: destino || null,
      }))
    );
    setImportando(false);
    if (error) return toast.error("No se pudo importar: " + error.message);
    toast.success(`Se importaron ${validas.length} partidos.`);
    setTexto("");
    onImported();
  }

  return (
    <div className="bg-[#121214] border border-[#27272a] rounded-2xl">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
        className="w-full flex items-center justify-between p-5 text-left"
      >
        <span>
          <span className="text-base font-bold text-white">📥 Importar fixture desde CSV o Excel</span>
          <span className="block text-xs text-zinc-400 mt-0.5">Cargá una fecha completa (o el torneo entero) de una sola vez.</span>
        </span>
        <span className="text-zinc-400 text-sm">{abierto ? "▲" : "▼"}</span>
      </button>

      {abierto && (
        <div className="px-5 pb-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              value={ligaId}
              onChange={(e) => setLigaId(e.target.value)}
              className="bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#ff7900]/50"
            >
              <option value="">1. Elegí la liga…</option>
              {ligas.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre_liga}
                </option>
              ))}
            </select>
            <select
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              className="bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#ff7900]/50"
            >
              <option value="">Visible para todos los medios</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  Solo {c.nombre_medio}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-zinc-400">
                2. Pegá las filas o subí un archivo. Columnas: <code className="text-[#ff7900]">fecha; hora; local; visitante; jornada</code> (la
                jornada es opcional). Sirve copiar y pegar desde Excel.
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTexto(EJEMPLO)}
                  className="text-xs font-bold text-zinc-300 border border-[#27272a] rounded-lg px-3 py-1.5 bg-[#09090b]"
                >
                  Ver ejemplo
                </button>
                <label className="text-xs font-bold text-zinc-300 border border-[#27272a] rounded-lg px-3 py-1.5 bg-[#09090b] cursor-pointer">
                  Subir .csv
                  <input type="file" accept=".csv,.txt,text/csv" onChange={onArchivo} className="sr-only" />
                </label>
              </div>
            </div>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={6}
              spellCheck={false}
              placeholder={EJEMPLO}
              className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#ff7900]/50 placeholder:text-zinc-700"
            />
          </div>

          {!ligaId && texto.trim() && <p className="text-xs text-amber-300">Elegí la liga para revisar los equipos.</p>}

          {filas.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3 text-xs font-semibold">
                <span className="text-green-400">✓ {validas.length} listos</span>
                {filas.some((f) => f.duplicado) && (
                  <span className="text-zinc-400">↺ {filas.filter((f) => f.duplicado).length} ya cargados (se omiten)</span>
                )}
                {filas.some((f) => f.error) && <span className="text-red-400">✕ {filas.filter((f) => f.error).length} con errores</span>}
              </div>
              <div className="max-h-72 overflow-auto border border-[#27272a] rounded-xl">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[#18181b] text-zinc-400 text-left">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Fecha y hora</th>
                      <th className="px-3 py-2">Partido</th>
                      <th className="px-3 py-2">Jornada</th>
                      <th className="px-3 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => (
                      <tr key={f.linea} className="border-t border-[#27272a] text-zinc-200">
                        <td className="px-3 py-2 text-zinc-500">{f.linea}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {f.fechaHora
                            ? new Date(f.fechaHora).toLocaleString("es-AR", {
                                timeZone: "America/Argentina/Buenos_Aires",
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                                hourCycle: "h23",
                              })
                            : "—"}
                        </td>
                        <td className="px-3 py-2">
                          {f.local && f.visitante ? `${f.local.nombre_equipo} vs ${f.visitante.nombre_equipo}` : <span className="text-zinc-500 font-mono">{f.texto}</span>}
                        </td>
                        <td className="px-3 py-2 text-zinc-400">{f.jornada || "—"}</td>
                        <td className="px-3 py-2">
                          {f.error ? (
                            <span className="text-red-400">{f.error}</span>
                          ) : f.duplicado ? (
                            <span className="text-zinc-400">Ya existe</span>
                          ) : (
                            <span className="text-green-400">OK</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={importar}
                disabled={importando || validas.length === 0}
                className="w-full bg-[#ff7900] hover:bg-[#e06b00] text-black font-extrabold py-3 rounded-xl text-sm disabled:opacity-40"
              >
                {importando ? "Importando…" : `Importar ${validas.length} partido${validas.length === 1 ? "" : "s"}`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
