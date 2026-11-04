"use client";

// Sincronización de fixture y resultados con ahorafutbol.ar.
import { useState } from "react";
import { toast } from "@/components/Toaster";

type Resumen = {
  liga: string;
  simulado: boolean;
  modo: "reciente" | "completo";
  consultas: number;
  recibidos: number;
  creados: number;
  actualizados: number;
  vinculados: number;
  sinCambios: number;
  omitidos: { partido: string; motivo: string }[];
  sinPareja: string[];
  goleadores: { nuevos: number; actualizados: number; sinCambios: number; sinEquipo: number } | null;
  zonas: number;
};

type Accion = { modo: "reciente" | "completo"; simular: boolean };

export default function SyncAhorafutbol({ onSynced }: { onSynced: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [corriendo, setCorriendo] = useState<string | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);

  async function correr({ modo, simular }: Accion) {
    if (!simular && modo === "completo") {
      const ok = window.confirm(
        "Se van a crear y actualizar los partidos de todo el año y la tabla de goleadores con los datos de ahorafutbol.ar.\n\n" +
          "En los partidos terminados y en los goles de cada jugador, lo del sitio reemplaza lo cargado a mano. ¿Seguir?"
      );
      if (!ok) return;
    }
    const clave = `${modo}-${simular}`;
    setCorriendo(clave);
    try {
      const res = await fetch("/api/sync/ahorafutbol", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modo, simular }),
      });
      if (res.status === 401) {
        window.location.reload();
        return;
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "No se pudo sincronizar.");
      setResumen(data.resumen);
      if (simular) {
        toast.info("Simulación lista: revisá el detalle antes de aplicar.");
      } else {
        const r: Resumen = data.resumen;
        toast.success(`Listo: ${r.creados} nuevos, ${r.actualizados} actualizados, ${r.vinculados} vinculados.`);
        onSynced();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo sincronizar.");
    } finally {
      setCorriendo(null);
    }
  }

  const boton = (accion: Accion, texto: string, principal = false) => {
    const clave = `${accion.modo}-${accion.simular}`;
    return (
      <button
        type="button"
        onClick={() => correr(accion)}
        disabled={corriendo !== null}
        className={
          (principal
            ? "bg-[#ff7900] hover:bg-[#ff8c1a] text-black "
            : "bg-[#27272a] hover:bg-[#3f3f46] text-white ") +
          "px-4 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        }
      >
        {corriendo === clave ? "Consultando el sitio…" : texto}
      </button>
    );
  };

  return (
    <div className="bg-[#121214] border border-[#27272a] rounded-2xl">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
        className="w-full flex items-center justify-between p-5 text-left"
      >
        <span>
          <span className="text-base font-bold text-white">🔄 Ponerse al día desde ahorafutbol.ar</span>
          <span className="block text-xs text-zinc-400 mt-0.5">
            Carga puntual para ponerse al día. La carga habitual la siguen haciendo los diarios.
          </span>
        </span>
        <span className="text-zinc-400 text-sm">{abierto ? "▲" : "▼"}</span>
      </button>

      {abierto && (
        <div className="px-5 pb-5 space-y-4">
          <ul className="text-xs text-zinc-400 space-y-1 list-disc pl-5">
            <li>Trae partidos y resultados. &quot;Año completo&quot; también trae la tabla de goleadores y las zonas que falten.</li>
            <li>Los partidos ya jugados quedan finalizados con el resultado del sitio. Los que están en juego no se tocan.</li>
            <li>Los partidos cargados a mano se vinculan con los del sitio en vez de duplicarse.</li>
            <li>Las posiciones se calculan solas con los resultados: no hace falta cargarlas.</li>
          </ul>

          <div className="flex flex-wrap gap-2">
            {boton({ modo: "reciente", simular: false }, "Traer últimas 3 semanas", true)}
            {boton({ modo: "completo", simular: true }, "Simular año completo")}
            {boton({ modo: "completo", simular: false }, "Traer año completo")}
          </div>

          {resumen && (
            <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-4 space-y-3 text-sm">
              <p className="font-bold text-white">
                {resumen.simulado ? "Simulación (no se guardó nada)" : "Resultado"} ·{" "}
                {resumen.modo === "completo" ? "año completo" : "últimos y próximos 21 días"}
              </p>
              <dl className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  ["Partidos en el sitio", resumen.recibidos],
                  [resumen.simulado ? "Se crearían" : "Nuevos", resumen.creados],
                  [resumen.simulado ? "Se vincularían" : "Vinculados", resumen.vinculados],
                  [resumen.simulado ? "Se actualizarían" : "Actualizados", resumen.actualizados],
                  ["Sin cambios", resumen.sinCambios],
                ].map(([k, v]) => (
                  <div key={k} className="bg-[#121214] rounded-lg p-2.5">
                    <dt className="text-[11px] text-zinc-400">{k}</dt>
                    <dd className="text-lg font-black text-white tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>

              {resumen.goleadores && (
                <p className="text-zinc-300">
                  👟 Goleadores: {resumen.goleadores.nuevos} {resumen.simulado ? "se agregarían" : "agregados"},{" "}
                  {resumen.goleadores.actualizados} {resumen.simulado ? "se actualizarían" : "actualizados"},{" "}
                  {resumen.goleadores.sinCambios} sin cambios
                  {resumen.goleadores.sinEquipo > 0 && ` (${resumen.goleadores.sinEquipo} sin equipo reconocido)`}.
                  {resumen.zonas > 0 && ` Zonas asignadas a ${resumen.zonas} equipos.`}
                </p>
              )}

              {resumen.omitidos.length > 0 && (
                <details open>
                  <summary className="cursor-pointer text-amber-400 font-semibold">
                    ⚠️ {resumen.omitidos.length} partidos no se pudieron cargar
                  </summary>
                  <ul className="mt-2 space-y-2 text-xs text-zinc-300">
                    {Object.entries(
                      resumen.omitidos.reduce<Record<string, string[]>>((acc, o) => {
                        (acc[o.motivo] ||= []).push(o.partido);
                        return acc;
                      }, {})
                    ).map(([motivo, lista]) => (
                      <li key={motivo}>
                        <details>
                          <summary className="cursor-pointer">
                            {motivo} <span className="text-zinc-400">({lista.length} partidos)</span>
                          </summary>
                          <ul className="mt-1 pl-4 space-y-0.5 text-zinc-400">
                            {lista.map((p) => (
                              <li key={p}>{p}</li>
                            ))}
                          </ul>
                        </details>
                      </li>
                    ))}
                  </ul>
                  {resumen.omitidos.some((o) => o.motivo.startsWith("No encuentro el equipo")) && (
                    <p className="mt-2 text-xs text-zinc-400">
                      Los equipos con nombre distinto al del sitio se vinculan con la migración 006 (equipos.ahorafutbol_id).
                    </p>
                  )}
                </details>
              )}

              {resumen.sinPareja.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-amber-400 font-semibold">
                    🔍 {resumen.sinPareja.length} partidos cargados a mano que el sitio no tiene
                  </summary>
                  <p className="mt-2 text-xs text-zinc-400">
                    Pueden estar duplicados, con local y visitante invertidos o con la fecha mal cargada. Revisalos en la
                    lista de partidos y borralos si sobran. No se borran solos porque pueden tener pronósticos del Prode.
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-zinc-300">
                    {resumen.sinPareja.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
