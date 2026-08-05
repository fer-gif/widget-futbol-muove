"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Partido = {
  id: string;
  equipo_local: { nombre_equipo: string; logo_url: string };
  equipo_visitante: { nombre_equipo: string; logo_url: string };
  goles_local: number;
  goles_visitante: number;
  estado_partido: string;
  minuto_actual: number | null;
  jornada: string | null;
  fecha_hora: string | null;
};

export default function EmbedPartidos() {
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPartidos() {
      try {
        // Filtrar partidos para excluir los finalizados (.neq("estado_partido", "finalizado"))
        const { data: rawPartidos } = await supabase
          .from("partidos")
          .select("*, equipo_local:equipos!partidos_equipo_local_id_fkey(nombre_equipo, logo_url), equipo_visitante:equipos!partidos_equipo_visitante_id_fkey(nombre_equipo, logo_url)")
          .neq("estado_partido", "finalizado")
          .order("fecha_hora", { ascending: true })
          .limit(10);

        if (rawPartidos && rawPartidos.length > 0) {
          const formatted: Partido[] = rawPartidos.map((p: any) => ({
            id: p.id,
            equipo_local: {
              nombre_equipo: p.equipo_local?.nombre_equipo || "Local",
              logo_url: p.equipo_local?.logo_url || "https://placehold.co/80x80/121214/fff?text=LOC",
            },
            equipo_visitante: {
              nombre_equipo: p.equipo_visitante?.nombre_equipo || "Visitante",
              logo_url: p.equipo_visitante?.logo_url || "https://placehold.co/80x80/121214/fff?text=VIS",
            },
            goles_local: p.goles_local || 0,
            goles_visitante: p.goles_visitante || 0,
            estado_partido: p.estado_partido || "programado",
            minuto_actual: p.minuto_actual,
            jornada: p.jornada || "Próxima Fecha",
            fecha_hora: p.fecha_hora,
          }));
          setPartidos(formatted);
        } else {
          setPartidos([]);
        }
      } catch (err) {
        console.error("Error loading embed partidos:", err);
      } finally {
        setLoading(false);
      }
    }
    loadPartidos();
  }, []);

  return (
    <div className="bg-[#09090b] text-[#f4f4f5] font-sans p-4 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#27272a] pb-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff7900] animate-pulse"></span>
          <h2 className="text-sm font-bold text-white tracking-wide uppercase">
            Fútbol de Necochea <span className="text-[#ff7900]">| Partidos</span>
          </h2>
        </div>
        <span className="text-[10px] bg-[#121214] border border-[#27272a] text-zinc-400 px-2 py-0.5 rounded font-mono">
          DataNE En Vivo
        </span>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-zinc-500">
          <div className="w-6 h-6 border-2 border-[#ff7900]/20 border-t-[#ff7900] rounded-full animate-spin mx-auto mb-2"></div>
          Cargando partidos...
        </div>
      ) : partidos.length === 0 ? (
        <div className="py-8 text-center text-xs text-zinc-500 bg-[#121214] rounded-xl border border-[#27272a]">
          No hay partidos registrados.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {partidos.map((p) => {
            const isLive = p.estado_partido === "en_vivo";
            const isFinalized = p.estado_partido === "finalizado";

            return (
              <div
                key={p.id}
                className={`bg-[#121214] border rounded-xl p-3 flex flex-col justify-between transition-all ${
                  isLive
                    ? "border-[#ff7900]/50 bg-[#121214]/90 shadow-lg shadow-[#ff7900]/5"
                    : "border-[#27272a]"
                }`}
              >
                {/* Header card */}
                <div className="flex justify-between items-center text-[10px] text-zinc-400 font-semibold mb-2">
                  <span>{p.jornada}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full font-bold uppercase ${
                      isLive
                        ? "bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse"
                        : isFinalized
                        ? "bg-blue-500/10 text-blue-400"
                        : "bg-[#09090b] text-zinc-500"
                    }`}
                  >
                    {isLive
                      ? `🔴 EN VIVO ${p.minuto_actual ? p.minuto_actual + "'" : ""}`
                      : isFinalized
                      ? "FINALIZADO"
                      : "PROGRAMADO"}
                  </span>
                </div>

                {/* Local vs Visitante */}
                <div className="flex items-center justify-between gap-2 py-2">
                  {/* Local */}
                  <div className="flex items-center gap-2 w-5/12">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.equipo_local.logo_url}
                      alt=""
                      className="w-7 h-7 object-contain flex-shrink-0"
                    />
                    <span className="text-xs font-bold text-white truncate">
                      {p.equipo_local.nombre_equipo}
                    </span>
                  </div>

                  {/* Marcador */}
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-[#09090b] border border-[#27272a] rounded-lg text-sm font-black text-white font-mono">
                    <span>{p.goles_local}</span>
                    <span className="text-zinc-600 font-normal text-xs">-</span>
                    <span>{p.goles_visitante}</span>
                  </div>

                  {/* Visitante */}
                  <div className="flex items-center justify-end gap-2 w-5/12 text-right">
                    <span className="text-xs font-bold text-white truncate">
                      {p.equipo_visitante.nombre_equipo}
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.equipo_visitante.logo_url}
                      alt=""
                      className="w-7 h-7 object-contain flex-shrink-0"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
