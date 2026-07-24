"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Partido = {
  id: string;
  liga_nombre: string;
  jornada: string;
  estado_partido: string;
  fecha_hora: string;
  equipo_local: { nombre: string; logo: string };
  equipo_visitante: { nombre: string; logo: string };
  goles_local: number;
  goles_visitante: number;
};

type User = {
  id: string;
  nombre: string;
  email: string;
  puntos_totales: number;
  racha_actual: number;
  cliente_id: string;
};

type League = {
  id: string;
  nombre_grupo: string;
  codigo_invitacion: string;
  es_creador: boolean;
};

type RankItem = {
  posicion: number;
  id: string;
  nombre: string;
  puntos_totales: number;
  racha_actual: number;
  es_usuario_actual: boolean;
};

export default function ProdeDataeNePage() {
  const [clientId, setClientId] = useState<string>("");
  const [clienteNombre, setClienteNombre] = useState<string>("Data eNe");
  const [loading, setLoading] = useState<boolean>(true);
  
  // Navigation & Data
  const [activeTab, setActiveTab] = useState<"fixture" | "ranking" | "amigos">("fixture");
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [jornadas, setJornadas] = useState<string[]>([]);
  const [selectedJornada, setSelectedJornada] = useState<string>("");
  const [predictions, setPredictions] = useState<Record<string, { local: number; visitante: number }>>({});
  
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState<string>("");
  const [authPin, setAuthPin] = useState<string>("");
  const [authNombre, setAuthNombre] = useState<string>("");
  const [authError, setAuthError] = useState<string>("");
  const [prodeMsg, setProdeMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Leaderboard & Friends State
  const [leaderboard, setLeaderboard] = useState<RankItem[]>([]);
  const [myLeagues, setMyLeagues] = useState<League[]>([]);
  const [activeLeagueId, setActiveLeagueId] = useState<string>("general");
  const [showGroupModal, setShowGroupModal] = useState<boolean>(false);
  const [newGroupName, setNewGroupName] = useState<string>("");
  const [joinCode, setJoinCode] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cid = params.get("client-id");
    
    if (cid) {
      setClientId(cid);
      initClient(cid);
    } else {
      fetchFirstClient();
    }
  }, []);

  async function fetchFirstClient() {
    try {
      const { data } = await supabase.from("clientes").select("id, nombre_medio").eq("estado", "activo").limit(1).single();
      if (data) {
        setClientId(data.id);
        setClienteNombre(data.nombre_medio);
        initClient(data.id);
      } else {
        // Fallback demo data
        initDemoData();
      }
    } catch (e) {
      initDemoData();
    }
  }

  function initDemoData() {
    setClienteNombre("Data eNe");
    const demoPartidos: Partido[] = [
      {
        id: "p1",
        liga_nombre: "Liga Necochense de Fútbol",
        jornada: "Fecha 5",
        estado_partido: "programado",
        fecha_hora: new Date().toISOString(),
        goles_local: 0,
        goles_visitante: 0,
        equipo_local: { nombre: "Del Valle", logo: "/escudos_necochea/del_valle.png" },
        equipo_visitante: { nombre: "Ministerio", logo: "/escudos_necochea/ministerio.png" }
      },
      {
        id: "p2",
        liga_nombre: "Liga Necochense de Fútbol",
        jornada: "Fecha 5",
        estado_partido: "programado",
        fecha_hora: new Date().toISOString(),
        goles_local: 0,
        goles_visitante: 0,
        equipo_local: { nombre: "Rivadavia", logo: "/escudos_necochea/rivadavia.png" },
        equipo_visitante: { nombre: "Mataderos", logo: "/escudos_necochea/mataderos.png" }
      },
      {
        id: "p3",
        liga_nombre: "Liga Necochense de Fútbol",
        jornada: "Fecha 5",
        estado_partido: "programado",
        fecha_hora: new Date().toISOString(),
        goles_local: 0,
        goles_visitante: 0,
        equipo_local: { nombre: "Estación Quequén", logo: "/escudos_necochea/estacion_quequen.png" },
        equipo_visitante: { nombre: "Villa Díaz Vélez", logo: "/escudos_necochea/villa_diaz_velez.png" }
      },
      {
        id: "p4",
        liga_nombre: "Liga Necochense de Fútbol",
        jornada: "Fecha 5",
        estado_partido: "programado",
        fecha_hora: new Date().toISOString(),
        goles_local: 0,
        goles_visitante: 0,
        equipo_local: { nombre: "Huracán", logo: "/escudos_necochea/huracan_de_necochea.png" },
        equipo_visitante: { nombre: "Villa del Parque", logo: "/escudos_necochea/villa_del_parque.png" }
      }
    ];

    setPartidos(demoPartidos);
    setJornadas(["Fecha 5"]);
    setSelectedJornada("Fecha 5");
    const initPreds: Record<string, { local: number; visitante: number }> = {};
    demoPartidos.forEach(p => { initPreds[p.id] = { local: 0, visitante: 0 }; });
    setPredictions(initPreds);
    setLoading(false);
  }

  async function initClient(cid: string) {
    setLoading(true);
    const stored = localStorage.getItem(`prode_user_${cid}`);
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch (e) {}
    }

    try {
      const res = await fetch(`/api/widget?client-id=${cid}`);
      const data = await res.json();
      if (data.success) {
        setClienteNombre(data.nombre_medio || "Data eNe");
        const matchesList: Partido[] = data.partidos || [];
        if (matchesList.length > 0) {
          setPartidos(matchesList);
          const uniqueJornadas = Array.from(new Set(matchesList.map((p) => p.jornada).filter(Boolean)));
          setJornadas(uniqueJornadas);
          if (uniqueJornadas.length > 0) setSelectedJornada(uniqueJornadas[0]);

          const initPreds: Record<string, { local: number; visitante: number }> = {};
          matchesList.forEach((p) => { initPreds[p.id] = { local: 0, visitante: 0 }; });
          setPredictions(initPreds);
        } else {
          initDemoData();
        }
      } else {
        initDemoData();
      }
    } catch (err) {
      initDemoData();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user && clientId) {
      fetchUserPredictions();
      fetchMyLeagues();
    }
  }, [user, clientId]);

  useEffect(() => {
    if (clientId) {
      fetchLeaderboard();
    }
  }, [clientId, activeLeagueId, user]);

  async function fetchUserPredictions() {
    if (!user) return;
    try {
      const res = await fetch(`/api/prode/predict?participante-id=${user.id}`);
      const data = await res.json();
      if (data.success && data.pronosticos) {
        setPredictions((prev) => {
          const next = { ...prev };
          data.pronosticos.forEach((pr: any) => {
            next[pr.partido_id] = {
              local: pr.goles_local_pred,
              visitante: pr.goles_visitante_pred,
            };
          });
          return next;
        });
      }
    } catch (e) {}
  }

  async function fetchLeaderboard() {
    if (!clientId) return;
    try {
      let url = `/api/prode/leaderboard?client-id=${clientId}`;
      if (user) url += `&participante-id=${user.id}`;
      if (activeLeagueId !== "general") url += `&liga-privada-id=${activeLeagueId}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setLeaderboard(data.ranking || []);
      }
    } catch (e) {}
  }

  async function fetchMyLeagues() {
    if (!user) return;
    try {
      const res = await fetch(`/api/prode/leagues?participante-id=${user.id}`);
      const data = await res.json();
      if (data.success) {
        setMyLeagues(data.ligas || []);
      }
    } catch (e) {}
  }

  function handleScoreChange(partidoId: string, team: "local" | "visitante", delta: number) {
    setPredictions((prev) => {
      const current = prev[partidoId] || { local: 0, visitante: 0 };
      const val = Math.max(0, current[team] + delta);
      return {
        ...prev,
        [partidoId]: {
          ...current,
          [team]: val,
        },
      };
    });
  }

  async function handleSavePredictions() {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setProdeMsg(null);
    const predictionsList = Object.keys(predictions).map((partidoId) => ({
      partidoId,
      golesLocal: predictions[partidoId].local,
      golesVisitante: predictions[partidoId].visitante,
    }));

    try {
      const res = await fetch("/api/prode/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participanteId: user.id,
          predictions: predictionsList,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setProdeMsg({ type: "success", text: "¡Tus pronósticos se guardaron correctamente en DataeNe!" });
      } else {
        setProdeMsg({ type: "error", text: data.error || "La fecha se encuentra cerrada." });
      }
    } catch (e) {
      setProdeMsg({ type: "error", text: "Error de red al conectar con el servidor." });
    }
  }

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");

    try {
      const res = await fetch("/api/prode/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: authMode,
          clientId: clientId || "demo-client-id",
          email: authEmail,
          pin: authPin,
          nombre: authNombre,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setUser(data.usuario);
        localStorage.setItem(`prode_user_${clientId}`, JSON.stringify(data.usuario));
        setShowAuthModal(false);
        setAuthPin("");
        handleSavePredictions();
      } else {
        setAuthError(data.error || "Datos incorrectos.");
      }
    } catch (e) {
      setAuthError("Error de conexión al autenticar.");
    }
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !newGroupName) return;

    try {
      const res = await fetch("/api/prode/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          clientId,
          participanteId: user.id,
          nombreGrupo: newGroupName,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchMyLeagues();
        setActiveLeagueId(data.liga.id);
        setShowGroupModal(false);
        setNewGroupName("");
      }
    } catch (e) {}
  }

  async function handleJoinGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !joinCode) return;

    try {
      const res = await fetch("/api/prode/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "join",
          participanteId: user.id,
          codigoInvitacion: joinCode,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchMyLeagues();
        setActiveLeagueId(data.liga.id);
        setShowGroupModal(false);
        setJoinCode("");
      }
    } catch (e) {}
  }

  function handleWhatsAppShare() {
    const text = encodeURIComponent(
      `¡Les voy ganando a todos en el Prode de Data eNe! 🏆 Llevo ${user ? user.puntos_totales : 0} puntos. Sumate a competir en el diario acá: ${window.location.href}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  }

  const filteredPartidos = selectedJornada
    ? partidos.filter((p) => p.jornada === selectedJornada)
    : partidos;

  return (

    <div className="min-h-screen bg-[#09090b] text-slate-100 font-sans flex flex-col justify-between">
      {/* Top Header con Branding Oficial de DataeNe */}
      <header className="border-b border-[#27272a] bg-[#121214] sticky top-0 z-40 px-4 py-3 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="https://dataene.com.ar/uploads/cliente/marca/20210210092501_positivo-horizontal-2x.png"
              alt="Data eNe"
              className="h-9 w-auto object-contain"
            />
            <span className="bg-[#EF426F] text-white font-extrabold text-[10px] uppercase tracking-wider px-3 py-1 rounded">
              PRODE NECOCHEA & QUEQUÉN
            </span>
          </div>

          {/* User Session Bar */}
          <div>
            {user ? (
              <div className="flex items-center gap-3 bg-[#18181b] border border-[#27272a] px-3.5 py-1.5 rounded-xl text-xs">
                <div>
                  <div className="font-extrabold text-white">👤 {user.nombre}</div>
                  <div className="text-[#EF426F] font-black">{user.puntos_totales} Puntos</div>
                </div>
                <button
                  onClick={() => {
                    setUser(null);
                    localStorage.removeItem(`prode_user_${clientId}`);
                  }}
                  className="text-slate-400 hover:text-[#EF426F] text-xs font-semibold ml-2"
                >
                  Salir
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setShowAuthModal(true);
                  setAuthMode("login");
                }}
                className="bg-[#EF426F] hover:bg-[#d83760] text-white text-xs font-extrabold py-2.5 px-4 rounded transition-all shadow-md"
              >
                🔑 Ingresar / Registrarme
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Sub-Header de DataeNe */}
      <div className="bg-[#121214] border-b border-[#27272a] py-6 px-4 text-center">
        <div className="max-w-3xl mx-auto space-y-2">
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            El Prode Oficial del Fútbol de <span className="text-[#EF426F]">Necochea y Quequén</span>
          </h1>
          <p className="text-xs text-zinc-400 max-w-xl mx-auto">
            Demostrá cuánto sabés del fútbol local. Arriesgá tus pronósticos cada fecha, sumá puntos y competí contra tus amigos en <strong className="text-white">Data eNe</strong>.
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto w-full px-4 py-8 flex-grow">
        {/* Navigation Tabs (Barra Violeta #7F35B2 con activo en Rosa #EF426F idéntico al sitio Data eNe) */}
        <div className="flex bg-[#7F35B2] p-1 mb-8 max-w-2xl mx-auto shadow-lg rounded">
          <button
            onClick={() => setActiveTab("fixture")}
            className={`flex-1 py-3 px-4 text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === "fixture" ? "bg-[#EF426F] text-white shadow-md" : "text-white/80 hover:bg-[#EF426F]/40"
            }`}
          >
            ⚽ Cargar Pronósticos
          </button>
          <button
            onClick={() => setActiveTab("ranking")}
            className={`flex-1 py-3 px-4 text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === "ranking" ? "bg-[#EF426F] text-white shadow-md" : "text-white/80 hover:bg-[#EF426F]/40"
            }`}
          >
            🏆 Posiciones DataeNe
          </button>
          <button
            onClick={() => setActiveTab("amigos")}
            className={`flex-1 py-3 px-4 text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === "amigos" ? "bg-[#EF426F] text-white shadow-md" : "text-white/80 hover:bg-[#EF426F]/40"
            }`}
          >
            👥 Ligas de Amigos
          </button>
        </div>

        {/* TAB 1: FIXTURE & VOTOS */}
        {activeTab === "fixture" && (
          <div className="space-y-6">
            {/* Jornadas Selector */}
            {jornadas.length > 0 && (
              <div className="flex items-center justify-between bg-[#121214] border border-[#27272a] rounded-2xl p-4 shadow-sm">
                <span className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider">Jornada Activa:</span>
                <div className="flex gap-2 overflow-x-auto">
                  {jornadas.map((j) => (
                    <button
                      key={j}
                      onClick={() => setSelectedJornada(j)}
                      className={`px-4 py-2 rounded text-xs font-black uppercase transition-colors ${
                        selectedJornada === j ? "bg-[#EF426F] text-white shadow-md" : "bg-[#09090b] text-zinc-300 hover:bg-[#27272a]"
                      }`}
                    >
                      {j}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Notification Banner */}
            {prodeMsg && (
              <div
                className={`p-4 rounded text-xs font-bold text-center border ${
                  prodeMsg.type === "success"
                    ? "bg-[#7F35B2]/20 border-[#7F35B2] text-[#EF426F]"
                    : "bg-red-500/10 border-red-500/30 text-red-400"
                }`}
              >
                {prodeMsg.text}
              </div>
            )}

            {/* Matches Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPartidos.map((p) => {
                const pred = predictions[p.id] || { local: 0, visitante: 0 };
                return (
                  <div key={p.id} className="bg-[#121214] border border-[#27272a] rounded-2xl p-5 hover:border-[#EF426F] transition-all flex flex-col justify-between gap-4 shadow-lg">
                    <div className="flex justify-between items-center text-[10px] font-black text-zinc-400 uppercase tracking-wider border-b border-[#27272a] pb-3">
                      <span>{p.liga_nombre}</span>
                      <span className="bg-[#EF426F] text-white px-2 py-0.5 rounded font-extrabold">{p.jornada}</span>
                    </div>

                    <div className="flex items-center justify-between gap-4 py-2">
                      {/* Local */}
                      <div className="flex flex-col items-center gap-2 flex-1 text-center">
                        <img src={p.equipo_local.logo || "https://placehold.co/40/121214/fff?text=L"} alt="" className="w-14 h-14 object-contain drop-shadow-xl" />
                        <span className="text-xs font-black text-white uppercase tracking-wide line-clamp-1">{p.equipo_local.nombre}</span>
                        
                        {/* Selector Local */}
                        <div className="flex items-center gap-2 bg-[#09090b] border border-[#27272a] p-1.5 rounded-xl">
                          <button onClick={() => handleScoreChange(p.id, "local", -1)} className="w-7 h-7 bg-[#18181b] hover:bg-[#EF426F] hover:text-white text-zinc-200 font-extrabold rounded transition-colors">-</button>
                          <span className="w-6 text-center font-black text-sm text-[#EF426F]">{pred.local}</span>
                          <button onClick={() => handleScoreChange(p.id, "local", 1)} className="w-7 h-7 bg-[#18181b] hover:bg-[#EF426F] hover:text-white text-zinc-200 font-extrabold rounded transition-colors">+</button>
                        </div>
                      </div>

                      <div className="font-black text-zinc-600 text-xs">VS</div>

                      {/* Visitante */}
                      <div className="flex flex-col items-center gap-2 flex-1 text-center">
                        <img src={p.equipo_visitante.logo || "https://placehold.co/40/121214/fff?text=V"} alt="" className="w-14 h-14 object-contain drop-shadow-xl" />
                        <span className="text-xs font-black text-white uppercase tracking-wide line-clamp-1">{p.equipo_visitante.nombre}</span>
                        
                        {/* Selector Visitante */}
                        <div className="flex items-center gap-2 bg-[#09090b] border border-[#27272a] p-1.5 rounded-xl">
                          <button onClick={() => handleScoreChange(p.id, "visitante", -1)} className="w-7 h-7 bg-[#18181b] hover:bg-[#EF426F] hover:text-white text-zinc-200 font-extrabold rounded transition-colors">-</button>
                          <span className="w-6 text-center font-black text-sm text-[#EF426F]">{pred.visitante}</span>
                          <button onClick={() => handleScoreChange(p.id, "visitante", 1)} className="w-7 h-7 bg-[#18181b] hover:bg-[#EF426F] hover:text-white text-zinc-200 font-extrabold rounded transition-colors">+</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sticky Save Action Bar */}
            <div className="sticky bottom-6 flex justify-center pt-4">
              <button
                onClick={handleSavePredictions}
                className="bg-[#EF426F] hover:bg-[#d83760] text-white font-black text-sm py-4 px-8 rounded-xl shadow-xl transition-all hover:scale-105"
              >
                💾 Guardar mis pronósticos de la fecha
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: RANKING & LEADERBOARD */}
        {activeTab === "ranking" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-[#121214] border border-[#27272a] rounded-2xl p-4 gap-4 flex-wrap shadow-md">
              <div className="flex gap-2 overflow-x-auto">
                <button
                  onClick={() => setActiveLeagueId("general")}
                  className={`px-4 py-2 rounded text-xs font-black uppercase transition-colors ${
                    activeLeagueId === "general" ? "bg-[#EF426F] text-white" : "bg-[#09090b] text-zinc-400 hover:text-white"
                  }`}
                >
                  🌍 Ranking General DataeNe
                </button>
                {myLeagues.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setActiveLeagueId(l.id)}
                    className={`px-4 py-2 rounded text-xs font-black uppercase transition-colors ${
                      activeLeagueId === l.id ? "bg-[#EF426F] text-white" : "bg-[#09090b] text-zinc-400 hover:text-white"
                    }`}
                  >
                    👥 {l.nombre_grupo}
                  </button>
                ))}
              </div>

              <button
                onClick={handleWhatsAppShare}
                className="bg-[#25D366] hover:bg-[#20bd5a] text-white font-extrabold text-xs py-2.5 px-4 rounded-xl flex items-center gap-2 transition-all shadow-lg"
              >
                📲 Compartir en WhatsApp
              </button>
            </div>

            {/* Leaderboard Table */}
            <div className="bg-[#121214] border border-[#27272a] rounded-2xl overflow-hidden shadow-xl">
              <div className="divide-y divide-[#27272a]">
                {leaderboard.length > 0 ? (
                  leaderboard.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between p-4 text-xs transition-colors ${
                        item.es_usuario_actual ? "bg-[#7F35B2]/20 border-l-4 border-[#EF426F]" : "hover:bg-[#09090b]"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <span className={`w-8 font-black text-sm ${item.posicion <= 3 ? "text-[#EF426F]" : "text-zinc-500"}`}>
                          #{item.posicion}
                        </span>
                        <span className="font-extrabold text-white text-sm">
                          {item.nombre} {item.es_usuario_actual && <span className="text-[#EF426F] text-xs">(Vos)</span>}
                        </span>
                      </div>
                      <div className="font-black text-sm text-[#EF426F]">{item.puntos_totales} pts</div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-xs font-bold text-zinc-400">
                    Aún no hay lectores registrados en el ranking de esta fecha. ¡Sé el primero en guardar tus pronósticos!
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: LIGAS DE AMIGOS */}
        {activeTab === "amigos" && (
          <div className="space-y-6 max-w-xl mx-auto">
            <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 space-y-6 shadow-xl">
              <h2 className="text-lg font-black text-white">🏆 Armá tu Liga de Amigos en DataeNe</h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Compartí un grupo privado con tus amigos de Necochea, Lobería o San Cayetano. Desafiálos fecha a fecha en el diario.
              </p>

              {/* Crear Grupo Form */}
              <form onSubmit={handleCreateGroup} className="space-y-3 pt-2">
                <label className="text-xs font-extrabold text-zinc-300">➕ Crear Grupo Nuevo:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nombre (ej. Amigos de la Facu)"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    required
                    className="flex-1 bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-[#EF426F]"
                  />
                  <button type="submit" className="bg-[#EF426F] hover:bg-[#d83760] text-white font-extrabold text-xs px-5 py-3 rounded-xl transition-all shadow-md">
                    Crear
                  </button>
                </div>
              </form>

              <div className="border-t border-[#27272a] pt-6">
                {/* Unirse Form */}
                <form onSubmit={handleJoinGroup} className="space-y-3">
                  <label className="text-xs font-extrabold text-zinc-300">🔑 Unirme con Código de Amigo:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Código (ej. ASADO26)"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      required
                      className="flex-1 bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-xs text-white uppercase outline-none focus:border-[#EF426F]"
                    />
                    <button type="submit" className="bg-[#18181b] hover:bg-[#27272a] text-white font-extrabold text-xs px-5 py-3 rounded-xl transition-all border border-[#27272a]">
                      Unirme
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* List of Joined Leagues */}
            {myLeagues.length > 0 && (
              <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 space-y-4 shadow-xl">
                <h3 className="text-xs font-black text-zinc-400 uppercase tracking-wider">Mis Grupos Activos</h3>
                <div className="space-y-2">
                  {myLeagues.map((l) => (
                    <div key={l.id} className="flex items-center justify-between bg-[#09090b] border border-[#27272a] p-4 rounded-xl">
                      <div>
                        <div className="font-extrabold text-sm text-white">{l.nombre_grupo}</div>
                        <div className="text-xs text-zinc-400 font-mono">Código: <span className="text-[#EF426F] font-black">{l.codigo_invitacion}</span></div>
                      </div>
                      <button
                        onClick={() => {
                          setActiveLeagueId(l.id);
                          setActiveTab("ranking");
                        }}
                        className="bg-[#18181b] hover:bg-[#27272a] text-white text-xs font-bold py-2 px-3 rounded-lg border border-[#27272a]"
                      >
                        Ver Ranking
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Auth Modal (Email + PIN) */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#121214] border border-[#27272a] rounded-3xl p-6 max-w-sm w-full space-y-5 relative shadow-2xl">
            <button onClick={() => setShowAuthModal(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-white font-extrabold text-sm">✕</button>

            <div className="text-center space-y-1">
              <img src="https://dataene.com.ar/uploads/cliente/marca/20210210092501_positivo-horizontal-2x.png" alt="Data eNe" className="h-7 mx-auto object-contain mb-2" />
              <h3 className="text-lg font-black text-white">
                {authMode === "login" ? "Ingresá a tu Cuenta" : "Creá tu Perfil de Jugador"}
              </h3>
              <p className="text-xs text-zinc-400">
                {authMode === "login" ? "Ingresá tu Email y tu PIN de 4 números." : "Elegí tu apodo y PIN para guardar tus puntos."}
              </p>
            </div>

            {authError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold p-3 rounded-xl text-center">
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-3">
              {authMode === "register" && (
                <input
                  type="text"
                  placeholder="Tu Apodo (ej. Juani)"
                  value={authNombre}
                  onChange={(e) => setAuthNombre(e.target.value)}
                  required
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-[#EF426F]"
                />
              )}
              <input
                type="email"
                placeholder="Tu Email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                required
                className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-[#EF426F]"
              />
              <input
                type="password"
                maxLength={4}
                placeholder="PIN de 4 números (ej. 1234)"
                value={authPin}
                onChange={(e) => setAuthPin(e.target.value)}
                required
                className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-[#EF426F]"
              />

              <button type="submit" className="w-full bg-[#EF426F] hover:bg-[#d83760] text-white font-extrabold text-xs py-3.5 rounded-xl transition-all shadow-md">
                {authMode === "login" ? "Ingresar y Guardar" : "Crear Perfil y Guardar"}
              </button>
            </form>

            <div className="text-center">
              <button
                onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
                className="text-xs text-zinc-400 hover:text-white underline font-medium"
              >
                {authMode === "login" ? "¿Primera vez? Registrate acá" : "¿Ya tenés cuenta? Iniciar Sesión"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Oficial */}
      <footer className="border-t border-[#27272a] py-6 text-center text-xs text-zinc-500 bg-[#09090b]">
        <p>© {new Date().getFullYear()} Data eNe | Todos los derechos reservados. Prode Desarrollado por Muove Widgets.</p>
      </footer>
    </div>
  );
}


