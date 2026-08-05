"use client";

import { useEffect, useState } from "react";

type Goleador = {
  posicion: number;
  nombre: string;
  equipo: string;
  logo?: string;
  goles: number;
};

export default function EmbedGoleadores() {
  const [goleadores, setGoleadores] = useState<Goleador[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGoleadores() {
      try {
        const res = await fetch("/api/goleadores");
        const data = await res.json();
        if (data.success) {
          setGoleadores(data.goleadores || []);
        }
      } catch (err) {
        console.error("Error loading scorers embed:", err);
      } finally {
        setLoading(false);
      }
    }
    loadGoleadores();
  }, []);

  return (
    <div className="bg-[#09090b] text-[#f4f4f5] font-sans p-4 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#27272a] pb-3 mb-4">
        <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
          <span>👟</span> Tabla de Goleadores <span className="text-[#ff7900]">| Necochea</span>
        </h2>
        <span className="text-[10px] bg-[#121214] border border-[#27272a] text-zinc-400 px-2 py-0.5 rounded font-mono">
          Temporada 2026
        </span>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-zinc-500">
          <div className="w-6 h-6 border-2 border-[#ff7900]/20 border-t-[#ff7900] rounded-full animate-spin mx-auto mb-2"></div>
          Cargando goleadores...
        </div>
      ) : goleadores.length === 0 ? (
        <div className="py-8 text-center text-xs text-zinc-500 bg-[#121214] rounded-xl border border-[#27272a]">
          No hay datos de goleadores cargados.
        </div>
      ) : (
        <div className="bg-[#121214] border border-[#27272a] rounded-xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#09090b] text-zinc-400 text-[11px] font-bold border-b border-[#27272a] uppercase">
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Jugador / Nombre</th>
                  <th className="py-2.5 px-3">Equipo</th>
                  <th className="py-2.5 px-3 text-center text-white">Goles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272a]/60">
                {goleadores.map((g) => (
                  <tr key={g.posicion} className="hover:bg-[#18181b] transition-colors">
                    <td className="py-2.5 px-3 text-center font-bold text-zinc-500 text-[11px]">
                      {g.posicion === 1 ? "🥇" : g.posicion === 2 ? "🥈" : g.posicion === 3 ? "🥉" : g.posicion}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-white">
                      {g.nombre}
                    </td>
                    <td className="py-2.5 px-3 text-zinc-300 flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {g.logo && <img src={g.logo} alt="" className="w-4 h-4 object-contain" />}
                      <span className="truncate">{g.equipo}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-extrabold text-[#ff7900] text-sm bg-[#09090b]/50">
                      ⚽ {g.goles}
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
