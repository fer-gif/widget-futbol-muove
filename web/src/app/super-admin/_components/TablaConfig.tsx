"use client";

// Configuración de la tabla de posiciones de una liga: inicio del torneo,
// cupos de clasificación y, por equipo, zona, nombre corto y descuentos de puntos.
import { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db-client";
import { toast } from "@/components/Toaster";

type Liga = {
  id: string;
  nombre_liga: string;
  torneo_inicio?: string | null;
  clasifican?: number | null;
};

type Equipo = {
  id: string;
  nombre_equipo: string;
  logo_url: string | null;
  zona?: string | null;
  nombre_corto?: string | null;
  ajuste_puntos?: number | null;
  ajuste_motivo?: string | null;
};

type Fila = { zona: string; nombre_corto: string; ajuste_puntos: number; ajuste_motivo: string };

const base =
  "bg-[#09090b] border border-[#27272a] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#ff7900]/50";
const campo = `${base} text-white`;

const filaDe = (e: Equipo): Fila => ({
  zona: e.zona || "",
  nombre_corto: e.nombre_corto || "",
  ajuste_puntos: Number(e.ajuste_puntos) || 0,
  ajuste_motivo: e.ajuste_motivo || "",
});

export default function TablaConfig({ ligas, onSaved }: { ligas: { id: string; nombre_liga: string }[]; onSaved?: () => void }) {
  const [ligaElegida, setLigaElegida] = useState("");
  const ligaId = ligaElegida || ligas[0]?.id || "";
  const [liga, setLiga] = useState<Liga | null>(null);
  const [ligaForm, setLigaForm] = useState({ torneo_inicio: "", clasifican: "" });
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [cambios, setCambios] = useState<Record<string, Fila>>({});
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    if (!ligaId) return;
    setCargando(true);
    const [l, e] = await Promise.all([
      db.from("ligas").select("*").eq("id", ligaId),
      db.from("equipos").select("*").eq("liga_id", ligaId).order("nombre_equipo", { ascending: true }),
    ]);
    setCargando(false);
    if (l.error || e.error) {
      toast.error((l.error || e.error)!.message);
      return;
    }
    const ligaRow = ((l.data as Liga[]) || [])[0] || null;
    setLiga(ligaRow);
    setLigaForm({
      torneo_inicio: ligaRow?.torneo_inicio?.slice(0, 10) || "",
      clasifican: ligaRow?.clasifican ? String(ligaRow.clasifican) : "",
    });
    setEquipos(((e.data as Equipo[]) || []).sort((a, b) => a.nombre_equipo.localeCompare(b.nombre_equipo)));
    setCambios({});
  }, [ligaId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  // Columnas de las migraciones 006 (zona, torneo_inicio) y 007 (el resto).
  const tiene006 = liga ? "torneo_inicio" in liga : true;
  const tiene007 = liga ? "clasifican" in liga : true;

  const zonas = useMemo(() => {
    const set = new Set(equipos.map((e) => (cambios[e.id]?.zona ?? e.zona ?? "").toUpperCase()).filter(Boolean));
    return [...new Set(["A", "B", ...set])].sort();
  }, [equipos, cambios]);

  const editar = (e: Equipo, parcial: Partial<Fila>) =>
    setCambios((c) => ({ ...c, [e.id]: { ...(c[e.id] || filaDe(e)), ...parcial } }));

  const sucios = equipos.filter((e) => {
    const c = cambios[e.id];
    return c && JSON.stringify(c) !== JSON.stringify(filaDe(e));
  });
  const ligaSucia =
    !!liga &&
    (ligaForm.torneo_inicio !== (liga.torneo_inicio?.slice(0, 10) || "") ||
      ligaForm.clasifican !== (liga.clasifican ? String(liga.clasifican) : ""));

  async function guardar() {
    setGuardando(true);
    try {
      if (ligaSucia && liga) {
        const datos: Record<string, unknown> = {};
        if (tiene006) datos.torneo_inicio = ligaForm.torneo_inicio || null;
        if (tiene007) {
          const n = parseInt(ligaForm.clasifican, 10);
          datos.clasifican = n >= 1 && n <= 40 ? n : null;
        }
        const { error } = await db.from("ligas").update(datos).eq("id", liga.id);
        if (error) throw new Error(`Liga: ${error.message}`);
      }
      for (const e of sucios) {
        const c = cambios[e.id];
        const datos: Record<string, unknown> = {};
        if (tiene006) datos.zona = c.zona.trim().toUpperCase() || null;
        if (tiene007) {
          datos.nombre_corto = c.nombre_corto.trim().slice(0, 24) || null;
          datos.ajuste_puntos = Math.trunc(Number(c.ajuste_puntos)) || 0;
          datos.ajuste_motivo = datos.ajuste_puntos ? c.ajuste_motivo.trim().slice(0, 120) || null : null;
        }
        const { error } = await db.from("equipos").update(datos).eq("id", e.id);
        if (error) throw new Error(`${e.nombre_equipo}: ${error.message}`);
      }
      toast.success("Tabla actualizada. El widget la muestra en un minuto.");
      await cargar();
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  const hayCambios = ligaSucia || sucios.length > 0;

  return (
    <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">📊 Tabla de posiciones</h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
            La tabla se calcula sola con los partidos finalizados. Acá se configura desde cuándo cuenta, cuántos clasifican y,
            por equipo, la zona, el nombre corto que se ve en el widget y los puntos que sume o reste la liga.
          </p>
        </div>
        {ligas.length > 1 && (
          <select
            value={ligaId}
            onChange={(e) => setLigaElegida(e.target.value)}
            className={`${campo} text-sm py-2`}
            aria-label="Liga"
          >
            {ligas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre_liga}
              </option>
            ))}
          </select>
        )}
      </div>

      {!tiene007 && (
        <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          Falta correr la migración {tiene006 ? "007" : "006 y la 007"} en Supabase para editar todo lo de esta sección.
        </p>
      )}

      {cargando && !liga ? (
        <p className="text-sm text-zinc-400">Cargando…</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-4">
            <label className="text-xs text-zinc-400 space-y-1">
              <span className="block font-semibold">Inicio del torneo actual</span>
              <input
                type="date"
                value={ligaForm.torneo_inicio}
                disabled={!tiene006}
                onChange={(e) => setLigaForm({ ...ligaForm, torneo_inicio: e.target.value })}
                className={`${campo} text-sm py-2 [color-scheme:dark]`}
              />
              <span className="block text-[10px] text-zinc-500">Cuentan los partidos desde este día. Cambiala con cada torneo nuevo.</span>
            </label>
            <label className="text-xs text-zinc-400 space-y-1">
              <span className="block font-semibold">Clasifican por zona</span>
              <input
                type="number"
                min={1}
                max={40}
                placeholder="—"
                value={ligaForm.clasifican}
                disabled={!tiene007}
                onChange={(e) => setLigaForm({ ...ligaForm, clasifican: e.target.value })}
                className={`${campo} text-sm py-2 w-24 text-center`}
              />
              <span className="block text-[10px] text-zinc-500">Marca la línea de corte. Vacío = sin línea.</span>
            </label>
          </div>

          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-xs min-w-[640px]">
              <thead>
                <tr className="text-zinc-500 text-[10px] uppercase tracking-wide">
                  <th className="text-left font-semibold px-2 py-2">Equipo</th>
                  <th className="text-left font-semibold px-2 py-2">Nombre corto</th>
                  <th className="font-semibold px-2 py-2">Zona</th>
                  <th className="font-semibold px-2 py-2" title="Puntos que suma o resta la liga">± Puntos</th>
                  <th className="text-left font-semibold px-2 py-2">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {equipos.map((e) => {
                  const f = cambios[e.id] || filaDe(e);
                  return (
                    <tr key={e.id} className="border-t border-[#27272a]">
                      <td className="px-2 py-2">
                        <span className="flex items-center gap-2 min-w-0">
                          {e.logo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={e.logo_url} alt="" className="w-6 h-6 object-contain shrink-0" />
                          ) : (
                            <span className="w-6 h-6 shrink-0" />
                          )}
                          <span className="font-semibold text-white truncate">{e.nombre_equipo}</span>
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={f.nombre_corto}
                          maxLength={24}
                          disabled={!tiene007}
                          placeholder={e.nombre_equipo}
                          onChange={(ev) => editar(e, { nombre_corto: ev.target.value })}
                          aria-label={`Nombre corto de ${e.nombre_equipo}`}
                          className={`${campo} w-40`}
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <select
                          value={f.zona.toUpperCase()}
                          disabled={!tiene006}
                          onChange={(ev) => editar(e, { zona: ev.target.value })}
                          aria-label={`Zona de ${e.nombre_equipo}`}
                          className={campo}
                        >
                          <option value="">—</option>
                          {zonas.map((z) => (
                            <option key={z} value={z}>
                              {z}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="number"
                          min={-99}
                          max={99}
                          value={f.ajuste_puntos}
                          disabled={!tiene007}
                          onChange={(ev) => editar(e, { ajuste_puntos: Number(ev.target.value) || 0 })}
                          aria-label={`Puntos sumados o restados a ${e.nombre_equipo}`}
                          className={`${base} w-16 text-center ${f.ajuste_puntos < 0 ? "text-red-400" : f.ajuste_puntos > 0 ? "text-green-400" : "text-white"}`}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={f.ajuste_motivo}
                          maxLength={120}
                          disabled={!tiene007 || !f.ajuste_puntos}
                          placeholder={f.ajuste_puntos ? "Ej. sanción del Tribunal" : ""}
                          onChange={(ev) => editar(e, { ajuste_motivo: ev.target.value })}
                          aria-label={`Motivo del ajuste de ${e.nombre_equipo}`}
                          className={`${campo} w-full min-w-40 disabled:opacity-40`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {hayCambios && <span className="text-xs text-zinc-400">Hay cambios sin guardar.</span>}
            {hayCambios && (
              <button type="button" onClick={cargar} className="text-xs text-zinc-400 hover:text-white px-3 py-2">
                Descartar
              </button>
            )}
            <button
              type="button"
              onClick={guardar}
              disabled={!hayCambios || guardando}
              className="bg-[#ff7900] hover:bg-[#ff8c1a] text-black font-bold px-5 py-2.5 rounded-xl text-sm disabled:opacity-40"
            >
              {guardando ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
