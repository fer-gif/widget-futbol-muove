"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

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
  fecha_hora: string;
  minuto_actual: number | null;
  liga_id: string;
  equipo_local?: Equipo;
  equipo_visitante?: Equipo;
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

  // Estados de Autenticación
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  // Estado para programación de partidos
  const [newPartido, setNewPartido] = useState({
    liga_id: "",
    equipo_local_id: "",
    equipo_visitante_id: "",
    fecha_hora: ""
  });

  useEffect(() => {
    const savedClient = localStorage.getItem("muove_journalist_client_id");
    const sessionActive = localStorage.getItem("muove_journalist_session_active");
    if (savedClient && sessionActive === "true") {
      setSelectedClientId(savedClient);
      setIsAuthenticated(true);
      fetchInitialData(savedClient);
    } else {
      fetchClientsOnly();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedLigaId) {
      fetchPartidos(selectedLigaId);
    } else {
      setPartidos([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLigaId]);

  async function fetchClientsOnly() {
    setLoading(true);
    try {
      const { data: dataClientes } = await supabase
        .from("clientes")
        .select("id, nombre_medio")
        .order("nombre_medio");
      setClientes(dataClientes || []);
    } catch (err) {
      console.error("Error al cargar clientes:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchInitialData(clientId: string) {
    setLoading(true);
    try {
      const { data: dataClientes } = await supabase
        .from("clientes")
        .select("id, nombre_medio")
        .order("nombre_medio");
      setClientes(dataClientes || []);

      const { data: dataEquipos } = await supabase
        .from("equipos")
        .select("*");
      setEquipos(dataEquipos || []);

      await fetchLigas(clientId);
    } catch (err) {
      console.error("Error al cargar datos iniciales:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchLigas(clientId: string) {
    const { data: asignaciones, error: errAsig } = await supabase
      .from("clientes_ligas")
      .select("liga_id")
      .eq("cliente_id", clientId);

    if (errAsig || !asignaciones || asignaciones.length === 0) {
      setLigas([]);
      return;
    }

    const ligaIds = asignaciones.map(a => a.liga_id);

    const { data: dataLigas } = await supabase
      .from("ligas")
      .select("*")
      .in("id", ligaIds)
      .eq("es_profesional", false)
      .order("nombre_liga");

    setLigas(dataLigas || []);
  }

  async function fetchPartidos(ligaId: string) {
    const { data, error } = await supabase
      .from("partidos")
      .select("*")
      .eq("liga_id", ligaId)
      .eq("cliente_id", selectedClientId)
      .order("fecha_hora", { ascending: true });

    if (error) {
      console.error("Error al cargar partidos:", error);
    } else {
      const partidosMapeados = (data || []).map((p: any) => ({
        ...p,
        equipo_local: equipos.find(e => e.id === p.equipo_local_id),
        equipo_visitante: equipos.find(e => e.id === p.equipo_visitante_id)
      }));
      setPartidos(partidosMapeados);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClientId) {
      setAuthError("Selecciona tu medio digital.");
      return;
    }
    if (!password) {
      setAuthError("Ingresa tu PIN/Clave de acceso.");
      return;
    }

    setLoading(true);
    setAuthError("");

    try {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nombre_medio, clave_periodista")
        .eq("id", selectedClientId)
        .eq("clave_periodista", password)
        .maybeSingle();

      if (error || !data) {
        setAuthError("Clave incorrecta. Verifica e intenta de nuevo.");
      } else {
        localStorage.setItem("muove_journalist_client_id", selectedClientId);
        localStorage.setItem("muove_journalist_session_active", "true");
        setIsAuthenticated(true);
        await fetchInitialData(selectedClientId);
      }
    } catch (err) {
      setAuthError("Error de comunicación con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("muove_journalist_session_active");
    setIsAuthenticated(false);
    setPassword("");
    setLigas([]);
    setPartidos([]);
    setSelectedLigaId("");
    fetchClientsOnly();
  }

  // --- LÓGICA DE PROGRAMACIÓN Y TRANSMISIÓN ---

  function getMatchLiveStatus(partido: Partido) {
    const now = new Date();
    const start = new Date(partido.fecha_hora);
    
    if (partido.estado_partido === "finalizado") {
      return { label: "FINALIZADO", styleClass: "bg-blue-500/10 text-blue-400 border border-blue-500/20", isLive: false, minuteText: "Finalizado" };
    }
    if (partido.estado_partido === "suspendido") {
      return { label: "SUSPENDIDO", styleClass: "bg-red-500/10 text-red-500 border border-red-500/20", isLive: false, minuteText: "Suspendido" };
    }
    if (partido.estado_partido === "demorado") {
      return { label: "DEMORADO", styleClass: "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20", isLive: false, minuteText: "Demorado" };
    }
    
    if (partido.estado_partido === "programado" && now >= start) {
      let minuteStr = "";
      if (partido.minuto_actual !== null) {
        minuteStr = `${partido.minuto_actual}'`;
      } else {
        const diffMin = Math.floor((now.getTime() - start.getTime()) / 60000);
        if (diffMin < 45) {
          minuteStr = `${diffMin}'`;
        } else if (diffMin >= 45 && diffMin < 60) {
          minuteStr = "ET";
        } else if (diffMin >= 60 && diffMin < 105) {
          minuteStr = `${diffMin - 15}'`;
        } else {
          minuteStr = "90+'";
        }
      }
      return { 
        label: `EN VIVO - ${minuteStr}`, 
        styleClass: "bg-green-500/10 text-green-400 border border-green-500/20 animate-pulse", 
        isLive: true, 
        minuteText: minuteStr 
      };
    }
    
    const formattedTime = start.toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' });
    return { 
      label: `PROGRAMADO - ${formattedTime} HS`, 
      styleClass: "bg-zinc-800 text-zinc-400 border border-zinc-700", 
      isLive: false, 
      minuteText: "Programado" 
    };
  }

  async function handleCreatePartido(e: React.FormEvent) {
    e.preventDefault();
    const { liga_id, equipo_local_id, equipo_visitante_id, fecha_hora } = newPartido;
    if (!liga_id || !equipo_local_id || !equipo_visitante_id || !fecha_hora) return;

    const { data, error } = await supabase
      .from("partidos")
      .insert([{
        liga_id,
        equipo_local_id,
        equipo_visitante_id,
        fecha_hora: new Date(fecha_hora).toISOString(),
        estado_partido: "programado",
        cliente_id: selectedClientId
      }])
      .select();

    if (error) {
      alert("Error al programar partido: " + error.message);
    } else {
      setNewPartido({ liga_id: "", equipo_local_id: "", equipo_visitante_id: "", fecha_hora: "" });
      if (selectedLigaId === liga_id) {
        fetchPartidos(liga_id);
      }
      alert("¡Partido programado exitosamente!");
    }
  }

  async function handleUpdateEstado(partidoId: string, nuevoEstado: string) {
    setUpdatingMatchId(partidoId);
    const payload: any = { estado_partido: nuevoEstado };
    if (nuevoEstado === "finalizado") {
      payload.minuto_actual = null;
    }

    const { error } = await supabase
      .from("partidos")
      .update(payload)
      .eq("id", partidoId);

    if (error) {
      alert("Error al actualizar estado del partido: " + error.message);
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

    const { error } = await supabase
      .from("partidos")
      .update({ goles_local: nuevosGolesLocal, goles_visitante: nuevosGolesVisitante })
      .eq("id", partidoId);

    if (error) {
      alert("Error al actualizar goles: " + error.message);
    } else {
      setPartidos(partidos.map(p => p.id === partidoId ? { ...p, goles_local: nuevosGolesLocal, goles_visitante: nuevosGolesVisitante } : p));
    }
  }

  async function handleUpdateMinuto(partidoId: string, minutoStr: string) {
    const minuto = parseInt(minutoStr, 10);
    if (isNaN(minuto)) return;

    const { error } = await supabase
      .from("partidos")
      .update({ minuto_actual: minuto })
      .eq("id", partidoId);

    if (error) {
      console.error("Error al actualizar minuto:", error);
    } else {
      setPartidos(partidos.map(p => p.id === partidoId ? { ...p, minuto_actual: minuto } : p));
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] font-sans flex flex-col justify-center items-center px-4 py-12">
        <div className="w-full max-w-md bg-[#121214] border border-[#27272a] rounded-2xl p-8 shadow-2xl shadow-black/80">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-white tracking-wide">
              MUOVE <span className="text-[#ff7900]">CMS</span>
            </h1>
            <p className="text-xs text-zinc-400 mt-2">Acceso exclusivo para periodistas de diarios asociados</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider">
                Selecciona tu Diario / Medio
              </label>
              {loading && clientes.length === 0 ? (
                <div className="h-12 bg-[#09090b] rounded-xl animate-pulse"></div>
              ) : (
                <select
                  value={selectedClientId}
                  onChange={e => {
                    setSelectedClientId(e.target.value);
                    setAuthError("");
                  }}
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff7900]/50 transition-colors"
                  required
                >
                  <option value="">-- Seleccionar Diario --</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre_medio}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider">
                PIN / Clave de Acceso
              </label>
              <input
                type="password"
                placeholder="••••••"
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  setAuthError("");
                }}
                className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff7900]/50 transition-colors text-center tracking-widest text-lg"
                required
              />
            </div>

            {authError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs py-3 px-4 rounded-xl text-center font-semibold">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#ff7900] hover:bg-[#e06b00] disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all text-sm shadow-lg shadow-[#ff7900]/10 flex justify-center items-center"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              ) : (
                "Ingresar al Panel"
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] font-sans pb-16">
      {/* Header */}
      <header className="border-b border-[#27272a] bg-[#121214] py-6 px-8 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wide">
              MUOVE <span className="text-[#ff7900]">| CMS PERIODISTA</span>
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs bg-[#ff7900]/10 text-[#ff7900] px-2 py-0.5 rounded font-bold border border-[#ff7900]/20">
                {clientes.find(c => c.id === selectedClientId)?.nombre_medio}
              </span>
              <span className="text-xs text-zinc-500">Gestión Descentralizada</span>
            </div>
          </div>
          <div className="flex gap-2">
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
                        <label className="block text-xs font-semibold text-zinc-400 mb-2">Fecha y Hora de Inicio</label>
                        <input
                          type="datetime-local"
                          value={newPartido.fecha_hora}
                          onChange={e => setNewPartido({ ...newPartido, fecha_hora: e.target.value })}
                          className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#ff7900]/50 transition-colors"
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-[#ff7900] hover:bg-[#e06b00] text-white font-bold py-3 rounded-xl transition-colors text-xs"
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
            {selectedLigaId && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-white mb-2">Partidos de la Liga ({partidos.length})</h2>
                
                {partidos.length === 0 ? (
                  <p className="text-zinc-500 text-xs text-center py-8 bg-[#121214] border border-[#27272a] rounded-2xl">
                    No hay partidos programados para esta liga.
                  </p>
                ) : (
                  partidos.map(partido => {
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
                          <span className="text-xs text-zinc-400 font-semibold">
                            {new Date(partido.fecha_hora).toLocaleDateString("es-AR", { weekday: 'long', day: 'numeric', month: 'short' })}
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

                          {/* Score */}
                          <div className="flex items-center gap-3 text-2xl font-black text-white">
                            <span>{partido.goles_local}</span>
                            <span className="text-zinc-600 text-sm font-normal">vs</span>
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
                              <span className="text-[10px] text-zinc-400 font-bold whitespace-nowrap">MINUTO MANUAL:</span>
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
                                <option value="demorado">⚠️ Demorado</option>
                                <option value="suspendido">🛑 Suspendido</option>
                                <option value="finalizado">🏁 Finalizado</option>
                              </select>
                            </div>
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
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
