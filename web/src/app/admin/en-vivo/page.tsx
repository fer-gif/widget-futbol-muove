"use client";

// Modo En Vivo: pantalla para el celular del periodista en la cancha.
// Botones grandes de gol y de reloj; muestra solo los partidos de hoy,
// los que están en vivo y los que quedaron sin cerrar.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/db-client";
import { matchClock } from "@/lib/match-clock";
import { toast } from "@/components/Toaster";

type Equipo = { id: string; nombre_equipo: string; logo_url: string | null };
type Partido = {
  id: string;
  liga_id: string;
  equipo_local_id: string;
  equipo_visitante_id: string;
  goles_local: number;
  goles_visitante: number;
  estado_partido: string;
  fecha_hora: string | null;
  minuto_actual: number | null;
  periodo?: string | null;
  periodo_inicio?: string | null;
  jornada?: string | null;
};
type Accion = "1T" | "ET" | "2T" | "FIN";

const TZ = "America/Argentina/Buenos_Aires";
const REFRESH_MS = 30000;

const diaAR = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
const horaAR = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TZ }) : "--:--";

export default function EnVivoPage() {
  const [medio, setMedio] = useState("");
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [equipos, setEquipos] = useState<Map<string, Equipo>>(new Map());
  const [ligas, setLigas] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [pendiente, setPendiente] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [ultimaCarga, setUltimaCarga] = useState<number | null>(null);
  const partidosRef = useRef<Partido[]>([]);
  useEffect(() => {
    partidosRef.current = partidos;
  }, [partidos]);

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    const desde = new Date(Date.now() - 3 * 864e5).toISOString();
    const hasta = new Date(Date.now() + 864e5).toISOString();
    const { data, error } = await db
      .from("partidos")
      .select("*")
      .gte("fecha_hora", desde)
      .lte("fecha_hora", hasta)
      .order("fecha_hora", { ascending: true });
    if (error) {
      if (!silencioso) toast.error("No se pudieron cargar los partidos: " + error.message);
    } else {
      setPartidos(data || []);
      setUltimaCarga(Date.now());
    }
    setLoading(false);
  }, []);

  // Carga inicial: sesión, equipos, ligas y partidos.
  useEffect(() => {
    (async () => {
      const me = await fetch("/api/auth/me").then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (!me?.session) {
        window.location.href = "/admin";
        return;
      }
      setMedio(me.session.nombre || "");
      const [{ data: eq }, { data: lg }] = await Promise.all([
        db.from("equipos").select("id, nombre_equipo, logo_url"),
        db.from("ligas").select("id, nombre_liga"),
      ]);
      setEquipos(new Map((eq || []).map((e: Equipo) => [e.id, e])));
      setLigas(new Map((lg || []).map((l: { id: string; nombre_liga: string }) => [l.id, l.nombre_liga])));
      await cargar();
    })();
  }, [cargar]);

  // Refresco periódico (pausado con la pestaña oculta) y reloj local.
  useEffect(() => {
    const refresh = setInterval(() => {
      if (!document.hidden) cargar(true);
    }, REFRESH_MS);
    const tick = setInterval(() => setNow(Date.now()), 10000);
    const onVisible = () => {
      if (!document.hidden) {
        setNow(Date.now());
        cargar(true);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(refresh);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [cargar]);

  // Solo lo relevante para la cancha: en vivo, sin cerrar y los de hoy.
  const visibles = useMemo(() => {
    const hoy = diaAR(new Date(now));
    const peso = (estado: string) => (estado === "en_vivo" ? 0 : estado === "a_confirmar" ? 1 : estado === "finalizado" ? 3 : 2);
    return partidos
      .map((p) => ({ p, reloj: matchClock(p, now) }))
      .filter(({ p, reloj }) => {
        if (reloj.estado === "en_vivo" || reloj.estado === "a_confirmar") return true;
        return p.fecha_hora ? diaAR(new Date(p.fecha_hora)) === hoy : false;
      })
      .sort((a, b) => peso(a.reloj.estado) - peso(b.reloj.estado));
  }, [partidos, now]);

  async function actualizar(id: string, cambios: Partial<Partido>, mensaje?: string) {
    const anterior = partidosRef.current.find((p) => p.id === id);
    if (!anterior) return;
    setPendiente(id);
    setPartidos((list) => list.map((p) => (p.id === id ? { ...p, ...cambios } : p))); // optimista
    const { error } = await db.from("partidos").update(cambios).eq("id", id);
    if (error) {
      setPartidos((list) => list.map((p) => (p.id === id ? anterior : p)));
      toast.error("No se guardó: " + error.message);
    } else if (mensaje) {
      toast.success(mensaje);
    }
    setPendiente(null);
  }

  function gol(p: Partido, lado: "local" | "visitante", delta: 1 | -1) {
    const campo = lado === "local" ? "goles_local" : "goles_visitante";
    const valor = Math.max(0, (p[campo] || 0) + delta);
    if (valor === p[campo]) return;
    if (delta > 0 && "vibrate" in navigator) navigator.vibrate(60);
    const equipo = equipos.get(lado === "local" ? p.equipo_local_id : p.equipo_visitante_id)?.nombre_equipo || "";
    const gl = lado === "local" ? valor : p.goles_local;
    const gv = lado === "visitante" ? valor : p.goles_visitante;
    actualizar(p.id, { [campo]: valor }, delta > 0 ? `⚽ Gol de ${equipo}: ${gl}-${gv}` : `Gol anulado: ${gl}-${gv}`);
  }

  function reloj(p: Partido, accion: Accion) {
    if (accion === "FIN") {
      if (!confirm(`¿Finalizar ${p.goles_local}-${p.goles_visitante}? Con esto se calculan los puntos del Prode.`)) return;
      actualizar(p.id, { estado_partido: "finalizado", periodo: null, periodo_inicio: null, minuto_actual: null }, "🏁 Partido finalizado");
      return;
    }
    const textos = { "1T": "▶ Arrancó el primer tiempo", ET: "⏸ Entretiempo", "2T": "▶ Arrancó el segundo tiempo" };
    actualizar(
      p.id,
      { estado_partido: "en_vivo", periodo: accion, periodo_inicio: new Date().toISOString(), minuto_actual: null },
      textos[accion]
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] font-sans pb-24">
      <header className="sticky top-0 z-30 bg-[#121214]/95 backdrop-blur border-b border-[#27272a] px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-base font-extrabold text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
            En vivo
          </h1>
          <p className="text-[11px] text-zinc-400 truncate">
            {medio}
            {ultimaCarga ? ` · actualizado ${new Date(ultimaCarga).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}` : ""}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => cargar()}
            className="text-xs font-bold text-zinc-300 border border-[#27272a] rounded-xl px-3 py-2 bg-[#09090b]"
            aria-label="Actualizar"
          >
            ↻
          </button>
          <Link href="/admin" className="text-xs font-bold text-zinc-300 border border-[#27272a] rounded-xl px-3 py-2 bg-[#09090b]">
            ← Panel
          </Link>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-3 pt-4 space-y-4">
        {loading && partidos.length === 0 && (
          <div className="space-y-4" aria-hidden="true">
            {[0, 1].map((i) => (
              <div key={i} className="h-64 rounded-2xl bg-[#121214] border border-[#27272a] animate-pulse" />
            ))}
          </div>
        )}

        {!loading && visibles.length === 0 && (
          <div className="text-center py-16 px-6 bg-[#121214] border border-[#27272a] rounded-2xl">
            <p className="text-sm text-zinc-300 font-semibold">No hay partidos hoy.</p>
            <p className="text-xs text-zinc-500 mt-1">Los partidos programados para hoy van a aparecer acá.</p>
            <Link href="/admin" className="inline-block mt-4 text-xs font-bold text-[#ff7900]">
              Ir al panel completo →
            </Link>
          </div>
        )}

        {visibles.map(({ p, reloj: r }) => {
          const local = equipos.get(p.equipo_local_id);
          const visita = equipos.get(p.equipo_visitante_id);
          const ocupado = pendiente === p.id;
          const finalizado = r.estado === "finalizado";
          const enVivo = r.estado === "en_vivo";

          let estado = `Hoy ${horaAR(p.fecha_hora)} hs`;
          let estadoClase = "bg-zinc-800 text-zinc-300";
          if (enVivo) {
            estado = `EN VIVO · ${r.minuto === "ET" ? "Entretiempo" : r.minuto || ""}${r.estimado ? " (estimado)" : ""}`;
            estadoClase = "bg-green-500/15 text-green-400";
          } else if (r.estado === "a_confirmar") {
            estado = "Sin cerrar · cargá el resultado y finalizá";
            estadoClase = "bg-orange-500/15 text-orange-300";
          } else if (finalizado) {
            estado = "Finalizado";
            estadoClase = "bg-blue-500/15 text-blue-300";
          } else if (r.estado === "suspendido" || r.estado === "demorado") {
            estado = r.estado === "suspendido" ? "Suspendido" : "Demorado";
            estadoClase = "bg-red-500/15 text-red-300";
          }

          const equipoCol = (eq: Equipo | undefined, lado: "local" | "visitante") => (
            <div className="flex flex-col items-center gap-2 min-w-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {eq?.logo_url ? <img src={eq.logo_url} alt="" className="w-12 h-12 object-contain" /> : <div className="w-12 h-12" />}
              <span className="text-xs font-bold text-white text-center leading-tight line-clamp-2">{eq?.nombre_equipo || "Equipo"}</span>
              <button
                type="button"
                disabled={ocupado || finalizado}
                onClick={() => gol(p, lado, 1)}
                className="w-full h-14 rounded-2xl bg-[#ff7900] active:bg-[#e06b00] text-black text-base font-black disabled:opacity-40 shadow-lg shadow-[#ff7900]/10"
              >
                + GOL
              </button>
              <button
                type="button"
                disabled={ocupado || finalizado || (lado === "local" ? p.goles_local : p.goles_visitante) === 0}
                onClick={() => gol(p, lado, -1)}
                className="w-full h-10 rounded-xl border border-[#27272a] bg-[#09090b] text-zinc-400 text-xs font-bold disabled:opacity-30"
                aria-label={`Restar gol a ${eq?.nombre_equipo || "equipo"}`}
              >
                − anular
              </button>
            </div>
          );

          return (
            <article
              key={p.id}
              className={`rounded-2xl border p-4 space-y-4 ${enVivo ? "border-green-500/30 bg-[#0f1411]" : "border-[#27272a] bg-[#121214]"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-zinc-400 font-semibold truncate">
                  {ligas.get(p.liga_id) || "Torneo"}
                  {p.jornada ? ` · ${p.jornada}` : ""}
                </span>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${estadoClase}`}>{estado}</span>
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start">
                {equipoCol(local, "local")}
                <div className="pt-3 text-4xl font-black tabular-nums text-white whitespace-nowrap" aria-live="polite">
                  {p.goles_local}
                  <span className="text-zinc-600 text-2xl mx-1">-</span>
                  {p.goles_visitante}
                </div>
                {equipoCol(visita, "visitante")}
              </div>

              <div className="grid grid-cols-4 gap-2" role="group" aria-label="Reloj del partido">
                {(
                  [
                    ["1T", "▶ 1T", enVivo && p.periodo === "1T"],
                    ["ET", "⏸ ET", enVivo && p.periodo === "ET"],
                    ["2T", "▶ 2T", enVivo && p.periodo === "2T"],
                    ["FIN", "🏁 Fin", finalizado],
                  ] as [Accion, string, boolean][]
                ).map(([accion, texto, activo]) => (
                  <button
                    key={accion}
                    type="button"
                    disabled={ocupado}
                    aria-pressed={activo}
                    onClick={() => reloj(p, accion)}
                    className={`h-12 rounded-xl text-xs font-extrabold border disabled:opacity-40 ${
                      activo ? "bg-green-500/20 border-green-500/50 text-green-300" : "bg-[#09090b] border-[#27272a] text-zinc-200"
                    }`}
                  >
                    {texto}
                  </button>
                ))}
              </div>
            </article>
          );
        })}
      </main>
    </div>
  );
}
