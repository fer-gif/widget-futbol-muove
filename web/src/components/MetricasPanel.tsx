"use client";

// Métricas del widget: impresiones, clics en el sponsor y en el Prode.
// Super-admin ve cualquier medio (o todos); el periodista solo el suyo.
import { useEffect, useMemo, useState } from "react";
import { toast } from "@/components/Toaster";

type Fila = {
  cliente_id: string;
  fecha: string;
  impresiones: number;
  clics_sponsor: number;
  clics_prode: number;
  interacciones: number;
};

type Props = {
  clientes: { id: string; nombre_medio: string }[];
  /** Si viene, el panel queda fijo en ese medio (vista del periodista). */
  fixedClienteId?: string;
};

const BAR_COLOR = "#e06b00"; // validado contra la superficie #121214 (dataviz)
const RANGOS = [7, 30, 90] as const;

const nf = new Intl.NumberFormat("es-AR");
const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%` : "—");

function diasEntre(desde: string, hasta: string): string[] {
  const out: string[] = [];
  const d = new Date(`${desde}T12:00:00Z`);
  const fin = new Date(`${hasta}T12:00:00Z`);
  while (d <= fin) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const fechaCorta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export default function MetricasPanel({ clientes, fixedClienteId }: Props) {
  const [dias, setDias] = useState<number>(30);
  const [clienteId, setClienteId] = useState<string>(fixedClienteId || "");
  const [filas, setFilas] = useState<Fila[]>([]);
  const [rango, setRango] = useState<{ desde: string; hasta: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ dias: String(dias) });
        if (clienteId) qs.set("cliente", clienteId);
        const res = await fetch(`/api/admin/metricas?${qs}`);
        const data = await res.json();
        if (cancelado) return;
        if (!data.success) throw new Error(data.error || "No se pudieron cargar las métricas");
        setFilas(data.filas);
        setRango({ desde: data.desde, hasta: data.hasta });
      } catch (err) {
        if (!cancelado) setError(err instanceof Error ? err.message : "Error al cargar métricas");
      } finally {
        if (!cancelado) setLoading(false);
      }
    }
    cargar();
    return () => {
      cancelado = true;
    };
  }, [dias, clienteId]);

  const nombreDe = useMemo(() => new Map(clientes.map((c) => [c.id, c.nombre_medio])), [clientes]);

  // Serie diaria (suma de los medios filtrados), con días sin datos en 0.
  const serie = useMemo(() => {
    if (!rango) return [];
    const porDia = new Map<string, Fila>();
    for (const f of filas) {
      const prev = porDia.get(f.fecha);
      porDia.set(
        f.fecha,
        prev
          ? {
              ...prev,
              impresiones: prev.impresiones + f.impresiones,
              clics_sponsor: prev.clics_sponsor + f.clics_sponsor,
              clics_prode: prev.clics_prode + f.clics_prode,
              interacciones: prev.interacciones + f.interacciones,
            }
          : { ...f }
      );
    }
    return diasEntre(rango.desde, rango.hasta).map(
      (fecha) =>
        porDia.get(fecha) || { cliente_id: "", fecha, impresiones: 0, clics_sponsor: 0, clics_prode: 0, interacciones: 0 }
    );
  }, [filas, rango]);

  const totales = useMemo(
    () =>
      serie.reduce(
        (acc, f) => ({
          impresiones: acc.impresiones + f.impresiones,
          clics_sponsor: acc.clics_sponsor + f.clics_sponsor,
          clics_prode: acc.clics_prode + f.clics_prode,
          interacciones: acc.interacciones + f.interacciones,
        }),
        { impresiones: 0, clics_sponsor: 0, clics_prode: 0, interacciones: 0 }
      ),
    [serie]
  );

  const porMedio = useMemo(() => {
    const m = new Map<string, { impresiones: number; clics_sponsor: number; clics_prode: number }>();
    for (const f of filas) {
      const p = m.get(f.cliente_id) || { impresiones: 0, clics_sponsor: 0, clics_prode: 0 };
      p.impresiones += f.impresiones;
      p.clics_sponsor += f.clics_sponsor;
      p.clics_prode += f.clics_prode;
      m.set(f.cliente_id, p);
    }
    return [...m.entries()].sort((a, b) => b[1].impresiones - a[1].impresiones);
  }, [filas]);

  const max = Math.max(1, ...serie.map((f) => f.impresiones));
  const nombreSeleccion = clienteId ? nombreDe.get(clienteId) || "Medio" : "Todos los medios";

  function exportarCsv() {
    const encabezado = "fecha,medio,impresiones,clics_sponsor,clics_prode,interacciones";
    const lineas = filas.map((f) =>
      [f.fecha, `"${(nombreDe.get(f.cliente_id) || f.cliente_id).replace(/"/g, '""')}"`, f.impresiones, f.clics_sponsor, f.clics_prode, f.interacciones].join(",")
    );
    const blob = new Blob(["﻿" + [encabezado, ...lineas].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `metricas-widget-${nombreSeleccion.toLowerCase().replace(/\s+/g, "-")}-${rango?.desde}-a-${rango?.hasta}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("CSV descargado.");
  }

  const tiles = [
    { label: "Impresiones", value: nf.format(totales.impresiones), hint: "Veces que el widget quedó visible en pantalla" },
    { label: "Clics en el sponsor", value: nf.format(totales.clics_sponsor), hint: "Clics en el logo de la cabecera" },
    { label: "CTR del sponsor", value: pct(totales.clics_sponsor, totales.impresiones), hint: "Clics en el sponsor / impresiones" },
    { label: "Clics al Prode", value: nf.format(totales.clics_prode), hint: "Clics en el banner del Prode" },
    { label: "Visitas que interactúan", value: pct(totales.interacciones, totales.impresiones), hint: "Usaron pestañas, filtros o flechas" },
  ];

  return (
    <section className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 space-y-6">
      {/* Encabezado y filtros en una sola fila */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">📈 Métricas del widget</h2>
          <p className="text-xs text-zinc-400">
            {nombreSeleccion} · {rango ? `${fechaCorta(rango.desde)} al ${fechaCorta(rango.hasta)}` : "…"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!fixedClienteId && (
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              aria-label="Medio"
              className="bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white font-semibold focus:outline-none focus:border-[#ff7900]/50"
            >
              <option value="">Todos los medios</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre_medio}
                </option>
              ))}
            </select>
          )}
          <div className="inline-flex border border-[#27272a] rounded-xl overflow-hidden" role="group" aria-label="Período">
            {RANGOS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setDias(r)}
                aria-pressed={dias === r}
                className={`px-3 py-2 text-xs font-bold ${dias === r ? "bg-[#ff7900] text-black" : "bg-[#09090b] text-zinc-400 hover:text-white"}`}
              >
                {r} días
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={exportarCsv}
            disabled={filas.length === 0}
            className="px-3 py-2 text-xs font-bold rounded-xl border border-[#27272a] bg-[#09090b] text-zinc-300 hover:text-white disabled:opacity-40"
          >
            ⬇ Exportar CSV
          </button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">{error}</p>
      ) : (
        <>
          {/* Indicadores */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {tiles.map((t) => (
              <div key={t.label} className="bg-[#09090b] border border-[#27272a] rounded-xl p-4" title={t.hint}>
                <div className="text-[11px] font-semibold text-zinc-400">{t.label}</div>
                <div className={`text-2xl font-extrabold text-white mt-1 tabular-nums ${loading ? "opacity-40" : ""}`}>{t.value}</div>
              </div>
            ))}
          </div>

          {/* Gráfico: impresiones por día (una sola serie, sin leyenda) */}
          <div>
            <h3 className="text-xs font-bold text-zinc-300 mb-3">Impresiones por día</h3>
            <div className="relative">
              <div className="flex text-[10px] text-zinc-500 justify-between mb-1 tabular-nums">
                <span>{nf.format(max)}</span>
              </div>
              <div
                className="relative h-44 flex items-end gap-[2px] border-b border-[#27272a]"
                onMouseLeave={() => setHover(null)}
              >
                {/* Línea de referencia del máximo, recesiva */}
                <div className="absolute inset-x-0 top-0 border-t border-dashed border-[#27272a]" aria-hidden="true" />
                {serie.map((f, i) => (
                  <div
                    key={f.fecha}
                    className="flex-1 h-full flex items-end cursor-default"
                    onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    tabIndex={0}
                    aria-label={`${fechaCorta(f.fecha)}: ${f.impresiones} impresiones, ${f.clics_sponsor} clics en sponsor`}
                  >
                    <div
                      className="w-full rounded-t-[4px] transition-opacity"
                      style={{
                        height: f.impresiones > 0 ? `${Math.max(2, (f.impresiones / max) * 100)}%` : "0",
                        background: BAR_COLOR,
                        opacity: hover === null || hover === i ? 1 : 0.45,
                      }}
                    />
                  </div>
                ))}
                {hover !== null && serie[hover] && (
                  <div
                    className="absolute -top-2 z-10 pointer-events-none bg-[#09090b] border border-[#3f3f46] rounded-lg px-3 py-2 text-xs text-zinc-200 shadow-xl whitespace-nowrap"
                    style={{
                      left: `${((hover + 0.5) / serie.length) * 100}%`,
                      transform: `translate(${hover > serie.length / 2 ? "-105%" : "5%"}, 0)`,
                    }}
                  >
                    <div className="font-bold text-white">{fechaCorta(serie[hover].fecha)}</div>
                    <div className="tabular-nums">{nf.format(serie[hover].impresiones)} impresiones</div>
                    <div className="tabular-nums text-zinc-400">
                      {nf.format(serie[hover].clics_sponsor)} clics sponsor · {nf.format(serie[hover].clics_prode)} Prode
                    </div>
                  </div>
                )}
              </div>
              {serie.length > 0 && (
                <div className="flex justify-between text-[10px] text-zinc-500 mt-1 tabular-nums">
                  <span>{fechaCorta(serie[0].fecha)}</span>
                  <span>{fechaCorta(serie[Math.floor(serie.length / 2)].fecha)}</span>
                  <span>{fechaCorta(serie[serie.length - 1].fecha)}</span>
                </div>
              )}
              {!loading && totales.impresiones === 0 && (
                <p className="absolute inset-0 flex items-center justify-center text-xs text-zinc-500">
                  Todavía no hay datos en este período.
                </p>
              )}
            </div>
          </div>

          {/* Ranking por medio (solo con "Todos") */}
          {!clienteId && porMedio.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-zinc-500 text-left">
                    <th className="py-2 font-semibold">Medio</th>
                    <th className="py-2 font-semibold text-right">Impresiones</th>
                    <th className="py-2 font-semibold text-right">Clics sponsor</th>
                    <th className="py-2 font-semibold text-right">CTR</th>
                    <th className="py-2 font-semibold text-right">Clics Prode</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {porMedio.map(([id, m]) => (
                    <tr key={id} className="border-t border-[#27272a] text-zinc-200">
                      <td className="py-2 font-semibold">{nombreDe.get(id) || id}</td>
                      <td className="py-2 text-right">{nf.format(m.impresiones)}</td>
                      <td className="py-2 text-right">{nf.format(m.clics_sponsor)}</td>
                      <td className="py-2 text-right">{pct(m.clics_sponsor, m.impresiones)}</td>
                      <td className="py-2 text-right">{nf.format(m.clics_prode)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Vista en tabla del gráfico */}
          <details className="text-xs text-zinc-400">
            <summary className="cursor-pointer font-semibold hover:text-white">Ver datos por día</summary>
            <div className="overflow-x-auto mt-2 max-h-64 overflow-y-auto">
              <table className="w-full tabular-nums">
                <thead>
                  <tr className="text-zinc-500 text-left">
                    <th className="py-1">Fecha</th>
                    <th className="py-1 text-right">Impresiones</th>
                    <th className="py-1 text-right">Clics sponsor</th>
                    <th className="py-1 text-right">Clics Prode</th>
                  </tr>
                </thead>
                <tbody>
                  {serie.map((f) => (
                    <tr key={f.fecha} className="border-t border-[#27272a] text-zinc-300">
                      <td className="py-1">{fechaCorta(f.fecha)}</td>
                      <td className="py-1 text-right">{nf.format(f.impresiones)}</td>
                      <td className="py-1 text-right">{nf.format(f.clics_sponsor)}</td>
                      <td className="py-1 text-right">{nf.format(f.clics_prode)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
