"use client";

import { useEffect, useState } from "react";
import { EquipoTabla } from "@/app/api/prode/standings/route";

export default function EmbedPosiciones() {
  const [activeZona, setActiveZona] = useState<"A" | "B">("A");
  const [zonaA, setZonaA] = useState<EquipoTabla[]>([]);
  const [zonaB, setZonaB] = useState<EquipoTabla[]>([]);
  const [ligaNombre, setLigaNombre] = useState<string>("Liga Necochea de Fútbol");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStandings() {
      try {
        const res = await fetch("/api/prode/standings");
        const data = await res.json();
        if (data.success) {
          setZonaA(data.zonaA || []);
          setZonaB(data.zonaB || []);
          if (data.ligaNombre) setLigaNombre(data.ligaNombre);
        }
      } catch (err) {
        console.error("Error loading standings embed:", err);
      } finally {
        setLoading(false);
      }
    }
    loadStandings();
  }, []);

  const listActual = activeZona === "A" ? zonaA : zonaB;

  return (
    <div className="bg-[#09090b] text-[#f4f4f5] font-sans p-4 min-h-screen">
      {/* Header con Select de Zona */}
      <div className="flex items-center justify-between border-b border-[#27272a] pb-3 mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
            <span>📊</span> {ligaNombre} <span className="text-[#ff7900]">| Posiciones</span>
          </h2>
        </div>

        <div className="flex gap-1.5 bg-[#121214] p-1 rounded-xl border border-[#27272a]">
          <button
            onClick={() => setActiveZona("A")}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
              activeZona === "A"
                ? "bg-[#ff7900] text-white shadow-md"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Zona A
          </button>
          <button
            onClick={() => setActiveZona("B")}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
              activeZona === "B"
                ? "bg-[#ff7900] text-white shadow-md"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Zona B
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-zinc-500">
          <div className="w-6 h-6 border-2 border-[#ff7900]/20 border-t-[#ff7900] rounded-full animate-spin mx-auto mb-2"></div>
          Cargando tabla de posiciones...
        </div>
      ) : (
        <div className="bg-[#121214] border border-[#27272a] rounded-xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#09090b] text-zinc-400 text-[11px] font-bold border-b border-[#27272a] uppercase">
                  <th className="py-2.5 px-3 w-8 text-center">#</th>
                  <th className="py-2.5 px-3">Equipo</th>
                  <th className="py-2.5 px-3 text-center">PJ</th>
                  <th className="py-2.5 px-3 text-center">G</th>
                  <th className="py-2.5 px-3 text-center">E</th>
                  <th className="py-2.5 px-3 text-center">P</th>
                  <th className="py-2.5 px-3 text-center">DG</th>
                  <th className="py-2.5 px-3 text-center text-white">PTS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272a]/60">
                {listActual.map((item) => (
                  <tr key={item.posicion} className="hover:bg-[#18181b] transition-colors">
                    <td className="py-2.5 px-3 text-center font-bold text-zinc-500 text-[11px]">
                      {item.posicion}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-white flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {item.logo && <img src={item.logo} alt="" className="w-5 h-5 object-contain" />}
                      <span className="truncate">{item.equipo}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-zinc-400">{item.jugados}</td>
                    <td className="py-2.5 px-3 text-center text-zinc-400">{item.ganados}</td>
                    <td className="py-2.5 px-3 text-center text-zinc-400">{item.empatados}</td>
                    <td className="py-2.5 px-3 text-center text-zinc-400">{item.perdidos}</td>
                    <td className={`py-2.5 px-3 text-center font-bold text-[11px] ${
                      item.diferenciaGol > 0 ? "text-emerald-400" : item.diferenciaGol < 0 ? "text-red-400" : "text-zinc-400"
                    }`}>
                      {item.diferenciaGol > 0 ? `+${item.diferenciaGol}` : item.diferenciaGol}
                    </td>
                    <td className="py-2.5 px-3 text-center font-extrabold text-[#ff7900] text-sm bg-[#09090b]/50">
                      {item.puntos}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
