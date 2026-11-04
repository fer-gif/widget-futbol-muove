"use client";

import { toast } from "@/components/Toaster";
import { useEffect, useState } from "react";
import Link from "next/link";
import { db, logout } from "@/lib/db-client";
import { matchClock } from "@/lib/match-clock";
import ProdeParticipantsManager from "@/components/ProdeParticipantsManager";
import MetricasPanel from "@/components/MetricasPanel";

type Liga = {
  id: string;
  nombre_liga: string;
  es_profesional: boolean;
};

type Equipo = {
  id: string;
  nombre_equipo: string;
  logo_url: string;
};

type Partido = {
  id: string;
  equipo_local_id: string;
  equipo_visitante_id: string;
  goles_local: number;
  goles_visitante: number;
  estado_partido: string;
  fecha_hora?: string | null;
  minuto_actual: number | null;
  periodo?: string | null;
  periodo_inicio?: string | null;
  liga_id: string;
  cliente_id?: string | null;
  equipo_local?: Equipo;
  equipo_visitante?: Equipo;
  jornada?: string | null;
};

export default function JournalistCMS() {
  const [ligas, setLigas] = useState<Liga[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedLigaId, setSelectedLigaId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [updatingMatchId, setUpdatingMatchId] = useState<string | null>(null);
  // Reloj para que el minuto de los partidos en vivo avance en pantalla.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);
  const [activeTab, setActiveTab] = useState<"partidos" | "prode_participantes" | "metricas">("partidos");

  // Estados de Filtros de Partidos para el Periodista
  const [filterEstado, setFilterEstado] = useState<"activos" | "en_vivo" | "programados" | "finalizados" | "todos">("activos");
  const [filterJornada, setFilterJornada] = useState<string>("");

  // Sesión (la valida el layout del servidor; acá solo se lee para saber el medio)
  const [sessionNombre, setSessionNombre] = useState("");

  // Estado para programación de partidos
  const [newPartido, setNewPartido] = useState({
    liga_id: "",
    equipo_local_id: "",
    equipo_visitante_id: "",
    fecha_hora: "",
    destinatario: "todos"
  });

  useEffect(() => {
    async function initDataNE() {
      setLoading(true);
      try {
        const meRes = await fetch("/api/auth/me");
        const me = meRes.ok ? (await meRes.json()).session : null;
        if (!me) {
          window.location.reload();
          return;
        }
        setSessionNombre(me.nombre || "");

        // Periodista: el servidor solo devuelve su propio medio. Super-admin: todos.
        const { data: allClientes } = await db
          .from("clientes")
          .select("id, nombre_medio")
          .order("nombre_medio");
        setClientes(allClientes || []);

        const clientId: string = me.clienteId || allClientes?.[0]?.id || "";
        setSelectedClientId(clientId);

        const { data: dataEquipos } = await db
          .from("equipos")
          .select("*")
          .order("nombre_equipo");
        setEquipos(dataEquipos || []);

        const { data: dataLigas } = await db
          .from("ligas")
          .select("*")
          .order("nombre_liga");
        const listLigas = dataLigas || [];
        setLigas(listLigas);

        if (listLigas.length > 0) {
          const firstLigaId = listLigas[0].id;
          setSelectedLigaId(firstLigaId);
          await fetchPartidos(firstLigaId, clientId, dataEquipos || []);
        }
      } catch (err) {
        console.error("Error al inicializar panel de periodistas:", err);
      } finally {
        setLoading(false);
      }
    }

    initDataNE();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedLigaId) {
      fetchPartidos(selectedLigaId, selectedClientId, equipos);
    } else {
      setPartidos([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLigaId]);

  async function fetchPartidos(ligaId: string, clientId: string = selectedClientId, eqList: Equipo[] = equipos) {
    const { data, error } = await db
      .from("partidos")
      .select("*")
      .eq("liga_id", ligaId)
      .order("fecha_hora", { ascending: true });

    if (error) {
      console.error("Error al cargar partidos:", error);
    } else {
      const partidosMapeados = (data || []).map((p: any) => ({
        ...p,
        equipo_local: eqList.find(e => e.id === p.equipo_local_id),
        equipo_visitante: eqList.find(e => e.id === p.equipo_visitante_id)
      }));
      setPartidos(partidosMapeados);
    }
  }


  const handleLogout = logout;


  const formatForDatetimeLocal = (isoStr?: string | null) => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // --- LÓGICA DE PROGRAMACIÓN Y TRANSMISIÓN ---

  function getMatchLiveStatus(partido: Partido) {
    const reloj = matchClock(partido, nowTick);
    const start = partido.fecha_hora ? new Date(partido.fecha_hora) : null;
    const hasValidStart = start && !isNaN(start.getTime());

    switch (reloj.estado) {
      case "finalizado":
        return { label: "FINALIZADO", styleClass: "bg-blue-500/10 text-blue-400 border border-blue-500/20", isLive: false, minuteText: "Finalizado" };
      case "suspendido":
        return { label: "SUSPENDIDO", styleClass: "bg-red-500/10 text-red-500 border border-red-500/20", isLive: false, minuteText: "Suspendido" };
      case "demorado":
        return { label: "DEMORADO", styleClass: "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20", isLive: false, minuteText: "Demorado" };
      case "a_confirmar":
        return { label: "SIN CERRAR · CARGÁ EL RESULTADO", styleClass: "bg-orange-500/10 text-orange-400 border border-orange-500/30", isLive: false, minuteText: "A confirmar" };
      case "en_vivo": {
        const min = reloj.minuto === "ET" ? "ENTRETIEMPO" : reloj.minuto || "";
        return {
          label: `EN VIVO${min ? ` - ${min}` : ""}${reloj.estimado ? " (estimado)" : ""}`,
          styleClass: "bg-green-500/10 text-green-400 border border-green-500/20 animate-pulse",
          isLive: true,
          minuteText: min,
        };
      }
      default: {
        const formattedTime = hasValidStart
          ? `${start.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Argentina/Buenos_Aires" })} HS`
          : "A CONFIRMAR";
        return {
          label: `PROGRAMADO - ${formattedTime}`,
          styleClass: "bg-zinc-800 text-zinc-400 border border-zinc-700",
          isLive: false,
          minuteText: "Programado",
        };
      }
    }
  }

  /** Botones de reloj: Iniciar 1T / Entretiempo / Iniciar 2T / Finalizar. */
  async function handleClock(partidoId: string, accion: "1T" | "ET" | "2T" | "FIN") {
    if (accion === "FIN" && !confirm("¿Finalizar el partido? Con esto se calculan los puntos del Prode.")) return;

    const payload =
      accion === "FIN"
        ? { estado_partido: "finalizado", periodo: null, periodo_inicio: null, minuto_actual: null }
        : { estado_partido: "en_vivo", periodo: accion, periodo_inicio: new Date().toISOString(), minuto_actual: null };

    setUpdatingMatchId(partidoId);
    const { error } = await db.from("partidos").update(payload).eq("id", partidoId);
    if (error) {
      toast.error("Error al actualizar el reloj del partido: " + error.message);
    } else {
      setPartidos(partidos.map(p => p.id === partidoId ? { ...p, ...payload } : p));
      setNowTick(Date.now());
    }
    setUpdatingMatchId(null);
  }

  async function handleCreatePartido(e: React.FormEvent) {
    e.preventDefault();
    const { liga_id, equipo_local_id, equipo_visitante_id, fecha_hora, destinatario } = newPartido;
    if (!liga_id || !equipo_local_id || !equipo_visitante_id) return;

    const targetClienteId = destinatario === "todos" ? null : destinatario;

    const { data, error } = await db
      .from("partidos")
      .insert([{
        liga_id,
        equipo_local_id,
        equipo_visitante_id,
        fecha_hora: fecha_hora ? new Date(fecha_hora).toISOString() : null,
        estado_partido: "programado",
        cliente_id: targetClienteId
      }])
      .select();

    if (error) {
      toast.error("Error al programar partido: " + error.message);
    } else {
      setNewPartido({ liga_id: "", equipo_local_id: "", equipo_visitante_id: "", fecha_hora: "", destinatario: "todos" });
      if (selectedLigaId === liga_id) {
        fetchPartidos(liga_id);
      }
      toast.success("¡Partido programado exitosamente!");
    }
  }

  async function handleUpdateClienteDestino(partidoId: string, clienteVal: string) {
    const targetVal = clienteVal === "todos" ? null : clienteVal;
    const { error } = await db
      .from("partidos")
      .update({ cliente_id: targetVal })
      .eq("id", partidoId);

    if (error) {
      toast.error("Error al actualizar diario destinatario: " + error.message);
    } else {
      setPartidos(partidos.map(p => p.id === partidoId ? { ...p, cliente_id: targetVal } : p));
    }
  }

  async function handleUpdateEstado(partidoId: string, nuevoEstado: string) {
    setUpdatingMatchId(partidoId);
    const payload: any = { estado_partido: nuevoEstado };
    if (nuevoEstado === "finalizado") {
      payload.minuto_actual = null;
    }

    const { error } = await db
      .from("partidos")
      .update(payload)
      .eq("id", partidoId);

    if (error) {
      toast.error("Error al actualizar estado del partido: " + error.message);
    } else {
      setPartidos(partidos.map(p => p.id === partidoId ? { ...p, ...payload } : p));
    }
    setUpdatingMatchId(null);
  }

  async function handleUpdateGoles(partidoId: string, tipo: "local" | "visitante", cantidad: number) {
    const partido = partidos.find(p => p.id === partidoId);
    if (!partido) return;

    const nuevosGolesLocal = tipo === "local" ? Math.max(0, partido.goles_local + cantidad) : partido.goles_local;
    const nuevosGolesVisitante = tipo === "visitante" ? Math.max(0, partido.goles_visitante + cantidad) : partido.goles_visitante;

    const { error } = await db
      .from("partidos")
      .update({ goles_local: nuevosGolesLocal, goles_visitante: nuevosGolesVisitante })
      .eq("id", partidoId);

    if (error) {
      toast.error("Error al actualizar goles: " + error.message);
    } else {
      setPartidos(partidos.map(p => p.id === partidoId ? { ...p, goles_local: nuevosGolesLocal, goles_visitante: nuevosGolesVisitante } : p));
    }
  }

  async function handleUpdateMinuto(partidoId: string, minutoStr: string) {
    const minuto = parseInt(minutoStr, 10);
    if (isNaN(minuto)) return;

    const { error } = await db
      .from("partidos")
      .update({ minuto_actual: minuto })
      .eq("id", partidoId);

    if (error) {
      console.error("Error al actualizar minuto:", error);
    } else {
      setPartidos(partidos.map(p => p.id === partidoId ? { ...p, minuto_actual: minuto } : p));
    }
  }

  async function handleUpdateJornada(partidoId: string, jornadaVal: string) {
    const { error } = await db
      .from("partidos")
      .update({ jornada: jornadaVal === "" ? null : jornadaVal })
      .eq("id", partidoId);

    if (error) {
      console.error("Error al actualizar la jornada:", error);
    } else {
      setPartidos(partidos.map(p => p.id === partidoId ? { ...p, jornada: jornadaVal === "" ? null : jornadaVal } : p));
    }
  }

  async function handleUpdateFechaHora(partidoId: string, fechaHoraVal: string) {
    const isoVal = fechaHoraVal ? new Date(fechaHoraVal).toISOString() : null;
    const { error } = await db
      .from("partidos")
      .update({ fecha_hora: isoVal })
      .eq("id", partidoId);

    if (error) {
      console.error("Error al actualizar fecha y hora:", error);
    } else {
      setPartidos(partidos.map(p => p.id === partidoId ? { ...p, fecha_hora: isoVal } : p));
    }
  }

  async function handleDeletePartido(partidoId: string) {
    if (!confirm("¿Estás seguro de que querés eliminar este partido del sistema?")) {
      return;
    }

    const { error } = await db
      .from("partidos")
      .delete()
      .eq("id", partidoId);

    if (error) {
      toast.error("Error al eliminar partido: " + error.message);
    } else {
      setPartidos(partidos.filter(p => p.id !== partidoId));
      toast.success("¡Partido eliminado exitosamente!");
    }
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] font-sans pb-16">
      {/* Header */}
      <header className="border-b border-[#27272a] bg-[#121214] py-6 px-8 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wide">
              {(sessionNombre || "Medio").toUpperCase()} <span className="text-[#ff7900]">| PANEL DE CONTROL</span>
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs bg-[#ff7900]/10 text-[#ff7900] px-2 py-0.5 rounded font-bold border border-[#ff7900]/20">
                Fútbol & Prode
              </span>
              <span className="text-xs text-zinc-500">Gestión en Vivo</span>
            </div>

          </div>
          <div className="flex gap-2 flex-wrap">
            <Link
              href="/admin/en-vivo"
              className="text-xs text-black bg-[#ff7900] hover:bg-[#e06b00] px-4 py-2 rounded-xl transition-all font-extrabold"
            >
              🔴 Modo En Vivo (celular)
            </Link>
            <button
              onClick={handleLogout}
              className="text-xs text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 px-4 py-2 rounded-xl bg-[#09090b] transition-all font-semibold"
            >
              Cerrar Sesión
            </button>
            <Link href="/" className="text-xs text-zinc-400 hover:text-[#ff7900] border border-zinc-800 hover:border-[#ff7900]/30 px-4 py-2 rounded-xl bg-[#09090b] transition-all font-semibold">
              ← Volver al Inicio
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-8">
        {/* Navigation Tabs */}
        <div className="flex border-b border-[#27272a] mb-8 gap-4 overflow-x-auto whitespace-nowrap">
          <button
            onClick={() => setActiveTab("partidos")}
            className={`py-3 px-4 text-sm font-bold border-b-2 transition-all ${
              activeTab === "partidos"
                ? "border-[#ff7900] text-[#ff7900]"
                : "border-transparent text-zinc-400 hover:text-white"
            }`}
          >
            ⚽ Transmisión & Fixture
          </button>
          <button
            onClick={() => setActiveTab("prode_participantes")}
            className={`py-3 px-4 text-sm font-bold border-b-2 transition-all ${
              activeTab === "prode_participantes"
                ? "border-[#ff7900] text-[#ff7900]"
                : "border-transparent text-zinc-400 hover:text-white"
            }`}
          >
            🏆 Usuarios del Prode & Mensajes
          </button>
          <button
            onClick={() => setActiveTab("metricas")}
            className={`py-3 px-4 text-sm font-bold border-b-2 transition-all ${
              activeTab === "metricas"
                ? "border-[#ff7900] text-[#ff7900]"
                : "border-transparent text-zinc-400 hover:text-white"
            }`}
          >
            📈 Métricas
          </button>
        </div>

        {activeTab === "metricas" ? (
          selectedClientId ? (
            <MetricasPanel clientes={clientes} fixedClienteId={selectedClientId} />
          ) : null
        ) : activeTab === "prode_participantes" ? (
          <ProdeParticipantsManager defaultClientId={selectedClientId} clientesList={clientes} />
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* COLUMNA 1: PROGRAMAR ENCUENTRO */}
          <div className="lg:col-span-1 bg-[#121214] border border-[#27272a] rounded-2xl p-6 h-fit space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white mb-2 font-sans">Programar Encuentro</h2>
              <p className="text-xs text-zinc-400 mb-4 font-sans">Carga un nuevo partido para transmitir el fin de semana.</p>
              
              {ligas.length === 0 ? (
                <div className="bg-[#09090b] border border-[#27272a] p-4 rounded-xl text-center text-xs text-zinc-500">
                  No tienes torneos asignados. Pide a Muove que te asigne ligas desde el SuperAdmin.
                </div>
              ) : (
                <form onSubmit={handleCreatePartido} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-2">Seleccionar Liga</label>
                    <select
                      value={newPartido.liga_id}
                      onChange={e => setNewPartido({ ...newPartido, liga_id: e.target.value, equipo_local_id: "", equipo_visitante_id: "" })}
                      className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#ff7900]/50 transition-colors"
                      required
                    >
                      <option value="">-- Seleccionar Liga --</option>
                      {ligas.map(l => (
                        <option key={l.id} value={l.id}>{l.nombre_liga}</option>
                      ))}
                    </select>
                  </div>

                  {newPartido.liga_id && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-400 mb-2">Equipo Local</label>
                        <select
                          value={newPartido.equipo_local_id}
                          onChange={e => setNewPartido({ ...newPartido, equipo_local_id: e.target.value })}
                          className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#ff7900]/50 transition-colors"
                          required
                        >
                          <option value="">-- Seleccionar Local --</option>
                          {equipos.filter(eq => eq.id !== "").map(eq => (
                            <option key={eq.id} value={eq.id}>{eq.nombre_equipo}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-zinc-400 mb-2">Equipo Visitante</label>
                        <select
                          value={newPartido.equipo_visitante_id}
                          onChange={e => setNewPartido({ ...newPartido, equipo_visitante_id: e.target.value })}
                          className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#ff7900]/50 transition-colors"
                          required
                        >
                          <option value="">-- Seleccionar Visitante --</option>
                          {equipos.filter(eq => eq.id !== "" && eq.id !== newPartido.equipo_local_id).map(eq => (
                            <option key={eq.id} value={eq.id}>{eq.nombre_equipo}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-zinc-400 mb-2">Fecha y Hora (Opcional - A confirmar)</label>
                        <input
                          type="datetime-local"
                          value={newPartido.fecha_hora}
                          onChange={e => setNewPartido({ ...newPartido, fecha_hora: e.target.value })}
                          className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#ff7900]/50 transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-zinc-400 mb-2">Medio / Diario Destinatario</label>
                        <select
                          value={newPartido.destinatario}
                          onChange={e => setNewPartido({ ...newPartido, destinatario: e.target.value })}
                          className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#ff7900]/50 transition-colors font-semibold"
                        >
                          <option value="todos">🌐 Todos los Diarios (Global - Recomendado)</option>
                          {clientes.map(c => (
                            <option key={c.id} value={c.id}>📰 {c.nombre_medio}</option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-[#ff7900] hover:bg-[#e06b00] text-white font-bold py-3 rounded-xl transition-colors text-xs shadow-lg shadow-[#ff7900]/10"
                      >
                        Programar Partido
                      </button>
                    </>
                  )}
                </form>
              )}
            </div>
          </div>

          {/* COLUMNA 2: LISTADO Y TRANSMISIÓN */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Filtro de Ligas */}
            <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-6">
              <label className="block text-sm font-bold text-zinc-300 mb-3">Filtrar Partidos por Torneo</label>
              {loading ? (
                <div className="h-10 bg-[#09090b] rounded-xl animate-pulse"></div>
              ) : (
                <select
                  value={selectedLigaId}
                  onChange={e => setSelectedLigaId(e.target.value)}
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-[#ff7900]/50 transition-colors font-semibold"
                >
                  <option value="">-- Seleccionar Torneo --</option>
                  {ligas.map(l => (
                    <option key={l.id} value={l.id}>{l.nombre_liga}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Listado de Partidos */}
            {selectedLigaId && (() => {
              const jornadasDisponibles = Array.from(
                new Set(partidos.map(p => p.jornada).filter((j): j is string => Boolean(j)))
              );

              const partidosFiltrados = partidos.filter(p => {
                const matchState = getMatchLiveStatus(p);
                
                if (filterEstado === "activos") {
                  if (p.estado_partido === "finalizado") return false;
                } else if (filterEstado === "en_vivo") {
                  if (!matchState.isLive && p.estado_partido !== "en_vivo") return false;
                } else if (filterEstado === "programados") {
                  if (p.estado_partido !== "programado") return false;
                } else if (filterEstado === "finalizados") {
                  if (p.estado_partido !== "finalizado") return false;
                }

                if (filterJornada && p.jornada !== filterJornada) {
                  return false;
                }

                return true;
              });

              const partidosProcesados = [...partidosFiltrados].sort((a, b) => {
                const stateA = getMatchLiveStatus(a);
                const stateB = getMatchLiveStatus(b);

                const getWeight = (p: Partido, st: any) => {
                  if (st.isLive || p.estado_partido === "en_vivo") return 1;
                  if (p.estado_partido === "programado") return 2;
                  if (p.estado_partido === "finalizado") return 3;
                  return 4;
                };

                const wA = getWeight(a, stateA);
                const wB = getWeight(b, stateB);

                if (wA !== wB) return wA - wB;

                const tA = a.fecha_hora ? new Date(a.fecha_hora).getTime() : 9999999999999;
                const tB = b.fecha_hora ? new Date(b.fecha_hora).getTime() : 9999999999999;

                if (wA === 2) {
                  return tA - tB;
                } else {
                  return tB - tA;
                }
              });

              return (
                <div className="space-y-4">
                  {/* Barra de Filtros Inteligentes de Partidos */}
                  <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-xs font-bold text-zinc-300 flex items-center gap-2">
                        ⚡ Filtros Rápidos de Partidos ({partidosProcesados.length} mostrados)
                      </span>
                      
                      {jornadasDisponibles.length > 0 && (
                        <select
                          value={filterJornada}
                          onChange={e => setFilterJornada(e.target.value)}
                          className="bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none font-semibold cursor-pointer"
                        >
                          <option value="">-- Todas las Jornadas --</option>
                          {jornadasDisponibles.map(j => (
                            <option key={j} value={j}>{j}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setFilterEstado("activos")}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                          filterEstado === "activos"
                            ? "bg-[#ff7900] text-white shadow-lg shadow-[#ff7900]/20"
                            : "bg-[#09090b] text-zinc-400 border border-[#27272a] hover:text-white"
                        }`}
                      >
                        🔴 En Vivo & Próximos
                      </button>

                      <button
                        type="button"
                        onClick={() => setFilterEstado("en_vivo")}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                          filterEstado === "en_vivo"
                            ? "bg-[#EF426F] text-white shadow-lg shadow-[#EF426F]/20"
                            : "bg-[#09090b] text-zinc-400 border border-[#27272a] hover:text-white"
                        }`}
                      >
                        🔥 Solo En Vivo
                      </button>

                      <button
                        type="button"
                        onClick={() => setFilterEstado("programados")}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                          filterEstado === "programados"
                            ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                            : "bg-[#09090b] text-zinc-400 border border-[#27272a] hover:text-white"
                        }`}
                      >
                        📅 Programados
                      </button>

                      <button
                        type="button"
                        onClick={() => setFilterEstado("finalizados")}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                          filterEstado === "finalizados"
                            ? "bg-zinc-700 text-white"
                            : "bg-[#09090b] text-zinc-400 border border-[#27272a] hover:text-white"
                        }`}
                      >
                        🏁 Finalizados
                      </button>

                      <button
                        type="button"
                        onClick={() => setFilterEstado("todos")}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                          filterEstado === "todos"
                            ? "bg-purple-600 text-white"
                            : "bg-[#09090b] text-zinc-400 border border-[#27272a] hover:text-white"
                        }`}
                      >
                        🌐 Todos ({partidos.length})
                      </button>
                    </div>
                  </div>

                  <h2 className="text-sm font-bold text-zinc-300 pt-2">Lista de Partidos ({partidosProcesados.length})</h2>
                  
                  {partidosProcesados.length === 0 ? (
                    <p className="text-zinc-500 text-xs text-center py-8 bg-[#121214] border border-[#27272a] rounded-2xl">
                      No hay partidos en esta categoría o filtro seleccionado.
                    </p>
                  ) : (
                    partidosProcesados.map(partido => {
                    const matchState = getMatchLiveStatus(partido);
                    return (
                      <div 
                        key={partido.id}
                        className={`bg-[#121214] border rounded-2xl p-6 transition-all ${
                          matchState.isLive 
                            ? "border-[#ff7900]/30 shadow-lg shadow-[#ff7900]/5 bg-[#121214]/90" 
                            : "border-[#27272a]"
                        }`}
                      >
                        {/* Header de la tarjeta */}
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-xs text-zinc-400 font-semibold flex items-center gap-2">
                            {partido.fecha_hora && !isNaN(new Date(partido.fecha_hora).getTime())
                              ? new Date(partido.fecha_hora).toLocaleDateString("es-AR", { weekday: 'long', day: 'numeric', month: 'short' })
                              : "A confirmar"}
                            {partido.jornada && <span className="bg-[#27272a] text-zinc-400 px-2 py-0.5 rounded text-[10px] font-bold">{partido.jornada}</span>}
                          </span>
                          
                          <span className={`text-xs px-3 py-1 rounded-full font-bold ${matchState.styleClass}`}>
                            {matchState.label}
                          </span>
                        </div>

                        {/* Panel de Marcador */}
                        <div className="flex items-center justify-between gap-4 py-4 border-y border-[#27272a]/50 my-4 bg-[#09090b]/55 px-4 rounded-xl">
                          {/* Local */}
                          <div className="flex flex-col items-center gap-2 w-5/12 text-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={partido.equipo_local?.logo_url} alt="" className="w-10 h-10 object-contain" />
                            <span className="text-xs font-bold text-white truncate max-w-full">{partido.equipo_local?.nombre_equipo}</span>
                          </div>

                          {/* Marcador */}
                          <div className="flex items-center gap-2 text-xl font-black text-white bg-[#121214] px-5 py-2 rounded-xl border border-[#27272a]">
                            <span>{partido.goles_local}</span>
                            <span className="text-zinc-600 font-normal text-sm px-1">-</span>
                            <span>{partido.goles_visitante}</span>
                          </div>

                          {/* Visitante */}
                          <div className="flex flex-col items-center gap-2 w-5/12 text-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={partido.equipo_visitante?.logo_url} alt="" className="w-10 h-10 object-contain" />
                            <span className="text-xs font-bold text-white truncate max-w-full">{partido.equipo_visitante?.nombre_equipo}</span>
                          </div>
                        </div>

                        {/* Controles de Periodista */}
                        <div className="space-y-4">
                          {/* Reloj del partido */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {([
                              { accion: "1T", texto: "▶ Iniciar 1T", activo: partido.estado_partido === "en_vivo" && partido.periodo === "1T" },
                              { accion: "ET", texto: "⏸ Entretiempo", activo: partido.estado_partido === "en_vivo" && partido.periodo === "ET" },
                              { accion: "2T", texto: "▶ Iniciar 2T", activo: partido.estado_partido === "en_vivo" && partido.periodo === "2T" },
                              { accion: "FIN", texto: "🏁 Finalizar", activo: partido.estado_partido === "finalizado" },
                            ] as const).map(btn => (
                              <button
                                key={btn.accion}
                                type="button"
                                disabled={updatingMatchId === partido.id}
                                onClick={() => handleClock(partido.id, btn.accion)}
                                aria-pressed={btn.activo}
                                className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all disabled:opacity-50 ${
                                  btn.activo
                                    ? "bg-green-500/15 text-green-400 border-green-500/40"
                                    : "bg-[#09090b] text-zinc-300 border-[#27272a] hover:border-[#ff7900]/40 hover:text-white"
                                }`}
                              >
                                {btn.texto}
                              </button>
                            ))}
                          </div>

                          {/* Fila de Botones Goles */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleUpdateGoles(partido.id, "local", -1)}
                                className="bg-[#09090b] hover:bg-zinc-800 text-zinc-300 font-bold py-2.5 px-3 rounded-xl text-sm border border-[#27272a] w-1/3 text-center"
                              >
                                -
                              </button>
                              <button
                                onClick={() => handleUpdateGoles(partido.id, "local", 1)}
                                className="bg-[#ff7900]/10 hover:bg-[#ff7900]/20 text-[#ff7900] font-bold py-2.5 px-3 rounded-xl text-sm border border-[#ff7900]/30 w-2/3 text-center flex items-center justify-center gap-1.5"
                              >
                                + GOL L
                              </button>
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={() => handleUpdateGoles(partido.id, "visitante", 1)}
                                className="bg-[#ff7900]/10 hover:bg-[#ff7900]/20 text-[#ff7900] font-bold py-2.5 px-3 rounded-xl text-sm border border-[#ff7900]/30 w-2/3 text-center flex items-center justify-center gap-1.5"
                              >
                                + GOL V
                              </button>
                              <button
                                onClick={() => handleUpdateGoles(partido.id, "visitante", -1)}
                                className="bg-[#09090b] hover:bg-zinc-800 text-zinc-300 font-bold py-2.5 px-3 rounded-xl text-sm border border-[#27272a] w-1/3 text-center"
                              >
                                -
                              </button>
                            </div>
                          </div>

                          {/* Control de Minuto Manual & Selector de Estado */}
                          <div className="flex flex-col sm:flex-row gap-4 items-end pt-2 border-t border-[#27272a]/30">
                            <div className="flex items-center gap-2 w-full sm:w-1/2">
                              <span className="text-[10px] text-zinc-400 font-bold whitespace-nowrap" title="Solo si no usás los botones de reloj">MINUTO MANUAL:</span>
                              <input
                                type="number"
                                min="0"
                                max="120"
                                value={partido.minuto_actual || ""}
                                placeholder="Auto"
                                onChange={e => handleUpdateMinuto(partido.id, e.target.value)}
                                className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white text-center focus:outline-none focus:border-[#ff7900]/50 font-sans"
                              />
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-1/2 justify-end">
                              <span className="text-[10px] text-zinc-400 font-bold whitespace-nowrap">ESTADO:</span>
                              <select
                                value={partido.estado_partido}
                                onChange={e => handleUpdateEstado(partido.id, e.target.value)}
                                className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff7900]/50 font-semibold"
                              >
                                <option value="programado">Normal (Automático)</option>
                                <option value="en_vivo">🟢 En vivo</option>
                                <option value="demorado">⚠️ Demorado</option>
                                <option value="suspendido">🛑 Suspendido</option>
                                <option value="finalizado">🏁 Finalizado</option>
                              </select>
                            </div>
                          </div>

                          {/* Fila de Edición de Jornada y Horario */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#27272a]/30">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-zinc-400 font-bold whitespace-nowrap uppercase">Jornada:</span>
                              <input
                                type="text"
                                value={partido.jornada || ""}
                                placeholder="Ej. Fecha 10, Octavos"
                                onChange={e => handleUpdateJornada(partido.id, e.target.value)}
                                className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff7900]/50 font-semibold"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-zinc-400 font-bold whitespace-nowrap uppercase">Horario/Fecha:</span>
                              <input
                                type="datetime-local"
                                value={formatForDatetimeLocal(partido.fecha_hora)}
                                onChange={e => handleUpdateFechaHora(partido.id, e.target.value)}
                                className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff7900]/50 font-semibold"
                              />
                            </div>
                          </div>
                          {/* Fila de Selección de Diario Destino y Acciones */}
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#27272a]/30 flex-wrap">
                            <div className="flex items-center gap-2 flex-grow min-w-[200px]">
                              <span className="text-[10px] text-zinc-400 font-bold whitespace-nowrap uppercase">Diario Destino:</span>
                              <select
                                value={partido.cliente_id || "todos"}
                                onChange={e => handleUpdateClienteDestino(partido.id, e.target.value)}
                                className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff7900]/50 font-semibold"
                              >
                                <option value="todos">🌐 Todos los Diarios (Global - Publicar a todos)</option>
                                {clientes.map(c => (
                                  <option key={c.id} value={c.id}>📰 Solo en {c.nombre_medio}</option>
                                ))}
                              </select>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeletePartido(partido.id)}
                              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs px-3 py-2 rounded-xl font-bold transition-all flex items-center gap-1 shrink-0"
                              title="Eliminar este partido"
                            >
                              🗑️ Borrar Partido
                            </button>
                          </div>

                          {partido.estado_partido === "finalizado" && (
                            <p className="text-[10px] text-zinc-500 text-center font-semibold pt-1">
                              ⚠️ El partido está finalizado. Puedes editarlo si fue un error, o cambiar su estado para reabrirlo.
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })()}
          </div>

        </div>
        )}
      </main>
    </div>
  );
}
