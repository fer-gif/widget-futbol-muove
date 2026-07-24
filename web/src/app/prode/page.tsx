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

function formatFechaHora(fechaHoraStr?: string | null): string {
  if (!fechaHoraStr) return "Día y hora a confirmar";
  let d = new Date(fechaHoraStr);
  if (isNaN(d.getTime())) {
    d = new Date(String(fechaHoraStr).replace(" ", "T"));
  }
  if (isNaN(d.getTime())) return fechaHoraStr;

  const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const diaNombre = dias[d.getDay()];
  const diaNum = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const hora = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");

  return `${diaNombre}. ${diaNum}/${mes} - ${hora}:${min} hs`;
}

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

  // Modales de Confirmación e Invitación
  const [showCreateConfirmModal, setShowCreateConfirmModal] = useState<boolean>(false);
  const [lastCreatedLeague, setLastCreatedLeague] = useState<{ nombre: string; codigo: string } | null>(null);
  const [groupError, setGroupError] = useState<string>("");

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
        fecha_hora: "2026-07-25T15:30:00.000Z",
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
        fecha_hora: "2026-07-25T17:30:00.000Z",
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
        fecha_hora: "2026-07-26T15:30:00.000Z",
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
        fecha_hora: "2026-07-26T17:30:00.000Z",
        goles_local: 0,
        goles_visitante: 0,
        equipo_local: { nombre: "Huracán", logo: "/escudos_necochea/huracan_de_necochea.png" },
        equipo_visitante: { nombre: "Villa del Parque", logo: "/escudos_necochea/villa_del_parque.png" }
      }
    ];

    setPartidos(demoPartidos);
    setJornadas(["Fecha 5"]);
    setSelectedJornada("Fecha 5");
    setLoading(false);
  }

  async function initClient(cid: string) {
    setLoading(true);
    try {
      const storedUser = localStorage.getItem(`prode_user_${cid}`);
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }

      const res = await fetch(`/api/widget?client-id=${cid}`);
      const data = await res.json();
      if (data && data.partidos) {
        setPartidos(data.partidos);
        const jList: string[] = Array.from(new Set(data.partidos.map((p: Partido) => p.jornada)));
        setJornadas(jList);
        if (jList.length > 0) setSelectedJornada(jList[0]);
      } else {
        initDemoData();
      }
    } catch (e) {
      initDemoData();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "ranking") {
      fetchLeaderboard();
    } else if (activeTab === "amigos") {
      if (user) {
        fetchMyLeagues();
      }
    }
  }, [activeTab, activeLeagueId, user]);

  async function fetchLeaderboard() {
    try {
      let url = `/api/prode/leaderboard?client-id=${clientId || "demo"}`;
      if (activeLeagueId !== "general") {
        url += `&liga-privada-id=${activeLeagueId}`;
      }
      if (user) {
        url += `&participante-id=${user.id}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.success) {
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
      setAuthMode("login");
      setAuthError("Ingresá o registrate con tu apodo para guardar tus pronósticos.");
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

  function handleCreateGroupClick(e: React.FormEvent) {
    e.preventDefault();
    setGroupError("");

    if (!user) {
      setShowAuthModal(true);
      setAuthMode("login");
      setAuthError("Debés ingresar o registrarte con tu usuario para crear una Liga de Amigos.");
      return;
    }
    if (!newGroupName.trim()) return;

    setShowCreateConfirmModal(true);
  }

  async function handleConfirmCreateGroup() {
    if (!user || !newGroupName.trim()) return;

    try {
      const res = await fetch("/api/prode/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          clientId,
          participanteId: user.id,
          nombreGrupo: newGroupName.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchMyLeagues();
        setLastCreatedLeague({
          nombre: data.liga.nombre_grupo,
          codigo: data.liga.codigo_invitacion,
        });
        setShowCreateConfirmModal(false);
        setNewGroupName("");
      } else {
        setGroupError(data.error || "Error al crear la liga de amigos.");
      }
    } catch (e) {
      setGroupError("Error de conexión.");
    }
  }

  async function handleJoinGroup(e: React.FormEvent) {
    e.preventDefault();
    setGroupError("");

    if (!user) {
      setShowAuthModal(true);
      setAuthMode("login");
      setAuthError("Debés ingresar o registrarte con tu usuario para unirte a una Liga de Amigos.");
      return;
    }
    if (!joinCode.trim()) return;

    try {
      const res = await fetch("/api/prode/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "join",
          participanteId: user.id,
          codigoInvitacion: joinCode.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchMyLeagues();
        setActiveLeagueId(data.liga.id);
        setActiveTab("ranking");
        setJoinCode("");
      } else {
        setGroupError(data.error || "No encontramos ningún grupo activo con ese código.");
      }
    } catch (e) {
      setGroupError("Error de red al intentar unirte.");
    }
  }

  function handleWhatsAppGroupShare(nombre: string, codigo: string) {
    const text = encodeURIComponent(
      `¡Sumate a mi Liga de Amigos "${nombre}" en el Prode de Data eNe! 🏆 Entrá al diario acá: ${window.location.origin}/prode e ingresá con mi código de grupo: ${codigo}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
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
    <div className="min-h-screen bg-white text-slate-800 font-sans flex flex-col justify-between">
      <header className="border-b border-slate-200 bg-white sticky top-0 z-40 px-4 py-2.5 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-center">
          <img
            src="https://dataene.com.ar/uploads/cliente/marca/20210210092501_positivo-horizontal-2x.png"
            alt="Data eNe"
            className="h-8 w-auto object-contain"
          />
        </div>
      </header>

      <div className="bg-slate-50 border-b border-slate-200 py-4 px-4 text-center">
        <div className="max-w-3xl mx-auto space-y-1">
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
            El PRODE de la <span className="text-[#EF426F]">Liga de Necochea</span>
          </h1>
          <p className="text-[11px] text-slate-600 max-w-xl mx-auto">
            Demostrá cuánto sabés del fútbol local. Arriesgá tus pronósticos cada fecha y competí en <strong className="text-slate-900">Data eNe</strong>.
          </p>
        </div>
      </div>

      <main className="max-w-5xl mx-auto w-full px-4 py-4 flex-grow">
        <div className="flex bg-[#7F35B2] p-1 mb-3 max-w-2xl mx-auto shadow-md rounded">
          <button
            onClick={() => setActiveTab("fixture")}
            className={`flex-1 py-2.5 px-3 text-[11px] font-black uppercase tracking-wider transition-all ${
              activeTab === "fixture" ? "bg-[#EF426F] text-white shadow-sm" : "text-white/80 hover:bg-[#EF426F]/40"
            }`}
          >
            ⚽ Cargar Pronósticos
          </button>
          <button
            onClick={() => setActiveTab("ranking")}
            className={`flex-1 py-2.5 px-3 text-[11px] font-black uppercase tracking-wider transition-all ${
              activeTab === "ranking" ? "bg-[#EF426F] text-white shadow-sm" : "text-white/80 hover:bg-[#EF426F]/40"
            }`}
          >
            🏆 Posiciones DataeNe
          </button>
          <button
            onClick={() => setActiveTab("amigos")}
            className={`flex-1 py-2.5 px-3 text-[11px] font-black uppercase tracking-wider transition-all ${
              activeTab === "amigos" ? "bg-[#EF426F] text-white shadow-sm" : "text-white/80 hover:bg-[#EF426F]/40"
            }`}
          >
            👥 Ligas de Amigos
          </button>
        </div>

        <div className="flex justify-center mb-6">
          {user ? (
            <div className="flex items-center gap-3 bg-slate-100 border border-slate-200 px-4 py-2 rounded-xl text-xs shadow-sm">
              <div>
                <span className="font-extrabold text-slate-900">👤 {user.nombre}</span>
                <span className="text-[#EF426F] font-black ml-2">({user.puntos_totales} Puntos)</span>
              </div>
              <button
                onClick={() => {
                  setUser(null);
                  localStorage.removeItem(`prode_user_${clientId}`);
                }}
                className="text-slate-500 hover:text-[#EF426F] text-xs font-semibold ml-2 underline"
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
              className="bg-[#EF426F] hover:bg-[#d83760] text-white text-xs font-extrabold py-2 px-5 rounded-lg transition-all shadow-sm flex items-center gap-2"
            >
              🔑 Ingresar / Registrarme
            </button>
          )}
        </div>

        {activeTab === "fixture" && (
          <div className="space-y-6">
            {jornadas.length > 0 && (
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm">
                <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Jornada Activa:</span>
                <div className="flex gap-2 overflow-x-auto">
                  {jornadas.map((j) => (
                    <button
                      key={j}
                      onClick={() => setSelectedJornada(j)}
                      className={`px-4 py-2 rounded text-xs font-black uppercase transition-colors ${
                        selectedJornada === j ? "bg-[#EF426F] text-white shadow-sm" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {j}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {prodeMsg && (
              <div
                className={`p-4 rounded text-xs font-bold text-center border ${
                  prodeMsg.type === "success"
                    ? "bg-[#7F35B2]/10 border-[#7F35B2] text-[#7F35B2]"
                    : "bg-red-500/10 border-red-500/30 text-red-600"
                }`}
              >
                {prodeMsg.text}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPartidos.map((p) => {
                const pred = predictions[p.id] || { local: 0, visitante: 0 };
                return (
                  <div key={p.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-[#EF426F] transition-all flex flex-col justify-between gap-4 shadow-sm">
                    <div className="flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-3 gap-2">
                      <span className="truncate">{p.liga_nombre}</span>
                      <span className="bg-[#EF426F] text-white px-2 py-0.5 rounded font-extrabold shrink-0">{p.jornada}</span>
                    </div>

                    <div className="flex items-center justify-between gap-4 py-2">
                      <div className="flex flex-col items-center gap-2 flex-1 text-center">
                        <img src={p.equipo_local.logo || "https://placehold.co/40/121214/fff?text=L"} alt="" className="w-14 h-14 object-contain drop-shadow" />
                        <span className="text-xs font-black text-slate-900 uppercase tracking-wide line-clamp-1">{p.equipo_local.nombre}</span>
                        
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-1.5 rounded-xl">
                          <button onClick={() => handleScoreChange(p.id, "local", -1)} className="w-7 h-7 bg-white hover:bg-[#EF426F] hover:text-white border border-slate-200 text-slate-800 font-extrabold rounded transition-colors">-</button>
                          <span className="w-6 text-center font-black text-sm text-[#EF426F]">{pred.local}</span>
                          <button onClick={() => handleScoreChange(p.id, "local", 1)} className="w-7 h-7 bg-white hover:bg-[#EF426F] hover:text-white border border-slate-200 text-slate-800 font-extrabold rounded transition-colors">+</button>
                        </div>
                      </div>

                      <div className="flex flex-col items-center justify-center gap-1.5 shrink-0">
                        <div className="font-black text-slate-400 text-xs">VS</div>
                        <div className="flex items-center gap-1 text-[10px] font-extrabold text-[#7F35B2] bg-[#7F35B2]/10 border border-[#7F35B2]/20 px-2 py-1 rounded-lg whitespace-nowrap shadow-xs">
                          🕒 {formatFechaHora(p.fecha_hora)}
                        </div>
                      </div>

                      <div className="flex flex-col items-center gap-2 flex-1 text-center">
                        <img src={p.equipo_visitante.logo || "https://placehold.co/40/121214/fff?text=V"} alt="" className="w-14 h-14 object-contain drop-shadow" />
                        <span className="text-xs font-black text-slate-900 uppercase tracking-wide line-clamp-1">{p.equipo_visitante.nombre}</span>
                        
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-1.5 rounded-xl">
                          <button onClick={() => handleScoreChange(p.id, "visitante", -1)} className="w-7 h-7 bg-white hover:bg-[#EF426F] hover:text-white border border-slate-200 text-slate-800 font-extrabold rounded transition-colors">-</button>
                          <span className="w-6 text-center font-black text-sm text-[#EF426F]">{pred.visitante}</span>
                          <button onClick={() => handleScoreChange(p.id, "visitante", 1)} className="w-7 h-7 bg-white hover:bg-[#EF426F] hover:text-white border border-slate-200 text-slate-800 font-extrabold rounded transition-colors">+</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="sticky bottom-6 flex justify-center pt-4">
              <button
                onClick={handleSavePredictions}
                className="bg-[#EF426F] hover:bg-[#d83760] text-white font-black text-sm py-4 px-8 rounded-xl shadow-lg transition-all hover:scale-105"
              >
                💾 Guardar mis pronósticos de la fecha
              </button>
            </div>
          </div>
        )}

        {activeTab === "ranking" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl p-4 gap-4 flex-wrap shadow-sm">
              <div className="flex gap-2 overflow-x-auto">
                <button
                  onClick={() => setActiveLeagueId("general")}
                  className={`px-4 py-2 rounded text-xs font-black uppercase transition-colors ${
                    activeLeagueId === "general" ? "bg-[#EF426F] text-white" : "bg-white border border-slate-200 text-slate-600 hover:text-slate-900"
                  }`}
                >
                  🌍 Ranking General DataeNe
                </button>
                {myLeagues.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setActiveLeagueId(l.id)}
                    className={`px-4 py-2 rounded text-xs font-black uppercase transition-colors ${
                      activeLeagueId === l.id ? "bg-[#EF426F] text-white" : "bg-white border border-slate-200 text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    👥 {l.nombre_grupo}
                  </button>
                ))}
              </div>

              <button
                onClick={handleWhatsAppShare}
                className="bg-[#25D366] hover:bg-[#20bd5a] text-white font-extrabold text-xs py-2.5 px-4 rounded-xl flex items-center gap-2 transition-all shadow-sm"
              >
                📲 Compartir en WhatsApp
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="divide-y divide-slate-100">
                {leaderboard.length > 0 ? (
                  leaderboard.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between p-4 text-xs transition-colors ${
                        item.es_usuario_actual ? "bg-[#7F35B2]/10 border-l-4 border-[#EF426F]" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <span className={`w-8 font-black text-sm ${item.posicion <= 3 ? "text-[#EF426F]" : "text-slate-400"}`}>
                          #{item.posicion}
                        </span>
                        <span className="font-extrabold text-slate-900 text-sm">
                          {item.nombre} {item.es_usuario_actual && <span className="text-[#EF426F] text-xs">(Vos)</span>}
                        </span>
                      </div>
                      <div className="font-black text-sm text-[#EF426F]">{item.puntos_totales} pts</div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-xs font-bold text-slate-500">
                    Aún no hay lectores registrados en el ranking de esta fecha. ¡Sé el primero en guardar tus pronósticos!
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "amigos" && (
          <div className="space-y-6 max-w-xl mx-auto">
            {lastCreatedLeague && (
              <div className="bg-[#7F35B2]/10 border border-[#7F35B2] rounded-2xl p-5 space-y-3 shadow-md text-center">
                <span className="bg-[#EF426F] text-white text-[10px] font-black uppercase px-2.5 py-1 rounded">
                  ¡Campeonato Creado con Éxito! 🎉
                </span>
                <h3 className="text-lg font-black text-slate-900">{lastCreatedLeague.nombre}</h3>
                <p className="text-xs text-slate-600">
                  Tu código único de grupo es: <strong className="text-[#7F35B2] font-mono text-sm px-2 py-1 bg-white rounded border border-slate-200">{lastCreatedLeague.codigo}</strong>
                </p>
                <div className="pt-2 flex justify-center gap-2">
                  <button
                    onClick={() => handleWhatsAppGroupShare(lastCreatedLeague.nombre, lastCreatedLeague.codigo)}
                    className="bg-[#25D366] hover:bg-[#20bd5a] text-white font-extrabold text-xs py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all shadow-md"
                  >
                    📲 Invitar Amigos por WhatsApp
                  </button>
                </div>
              </div>
            )}

            {groupError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-600 text-xs font-bold p-3 rounded-xl text-center">
                {groupError}
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
              <h2 className="text-lg font-black text-slate-900">🏆 Armá tu Liga de Amigos en DataeNe</h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Compartí un grupo privado con tus amigos de Necochea, Lobería o San Cayetano. Desafiálos fecha a fecha en el diario.
              </p>

              <form onSubmit={handleCreateGroupClick} className="space-y-3 pt-2">
                <label className="text-xs font-extrabold text-slate-700">➕ Crear Grupo Nuevo:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nombre (ej. Amigos de la Facu)"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    required
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-900 outline-none focus:border-[#EF426F]"
                  />
                  <button type="submit" className="bg-[#EF426F] hover:bg-[#d83760] text-white font-extrabold text-xs px-5 py-3 rounded-xl transition-all shadow-sm">
                    Crear
                  </button>
                </div>
              </form>

              <div className="border-t border-slate-100 pt-6">
                <form onSubmit={handleJoinGroup} className="space-y-3">
                  <label className="text-xs font-extrabold text-slate-700">🔑 Unirme con Código de Amigo:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Código (ej. ASADO26)"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      required
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-900 uppercase outline-none focus:border-[#EF426F]"
                    />
                    <button type="submit" className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs px-5 py-3 rounded-xl transition-all border border-slate-200">
                      Unirme
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {myLeagues.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">Mis Grupos Activos</h3>
                <div className="space-y-2">
                  {myLeagues.map((l) => (
                    <div key={l.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 p-4 rounded-xl">
                      <div>
                        <div className="font-extrabold text-sm text-slate-900">{l.nombre_grupo}</div>
                        <div className="text-xs text-slate-500 font-mono">Código: <span className="text-[#EF426F] font-black">{l.codigo_invitacion}</span></div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleWhatsAppGroupShare(l.nombre_grupo, l.codigo_invitacion)}
                          className="bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center gap-1 shadow-sm"
                        >
                          📲 Invitar
                        </button>
                        <button
                          onClick={() => {
                            setActiveLeagueId(l.id);
                            setActiveTab("ranking");
                          }}
                          className="bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold py-2 px-3 rounded-lg border border-slate-200"
                        >
                          Ver Ranking
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {showCreateConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full space-y-4 relative shadow-2xl text-center">
            <button onClick={() => setShowCreateConfirmModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 font-extrabold text-sm">✕</button>

            <span className="text-3xl block">🏆</span>
            <h3 className="text-lg font-black text-slate-900">
              ¿Querés crear este nuevo campeonato con amigos?
            </h3>
            <p className="text-xs text-slate-600">
              Vas a crear la liga <strong className="text-slate-900">"{newGroupName}"</strong>. Al confirmar, te generaremos un código único para que invites a tus amigos por WhatsApp.
            </p>

            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={handleConfirmCreateGroup}
                className="w-full bg-[#EF426F] hover:bg-[#d83760] text-white font-extrabold text-xs py-3.5 rounded-xl transition-all shadow-sm"
              >
                Sí, crear campeonato
              </button>
              <button
                onClick={() => setShowCreateConfirmModal(false)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs py-2.5 rounded-xl transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showAuthModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full space-y-5 relative shadow-2xl">
            <button onClick={() => setShowAuthModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 font-extrabold text-sm">✕</button>

            <div className="text-center space-y-1">
              <img src="https://dataene.com.ar/uploads/cliente/marca/20210210092501_positivo-horizontal-2x.png" alt="Data eNe" className="h-7 mx-auto object-contain mb-2" />
              <h3 className="text-lg font-black text-slate-900">
                {authMode === "login" ? "Ingresá a tu Cuenta" : "Creá tu Perfil de Jugador"}
              </h3>
              <p className="text-xs text-slate-500">
                {authMode === "login" ? "Ingresá tu Email y tu PIN de 4 números." : "Elegí tu apodo y PIN para guardar tus puntos."}
              </p>
            </div>

            {authError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-600 text-xs font-bold p-3 rounded-xl text-center">
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-900 outline-none focus:border-[#EF426F]"
                />
              )}
              <input
                type="email"
                placeholder="Tu Email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-900 outline-none focus:border-[#EF426F]"
              />
              <input
                type="password"
                maxLength={4}
                placeholder="PIN de 4 números (ej. 1234)"
                value={authPin}
                onChange={(e) => setAuthPin(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-900 outline-none focus:border-[#EF426F]"
              />

              <button type="submit" className="w-full bg-[#EF426F] hover:bg-[#d83760] text-white font-extrabold text-xs py-3.5 rounded-xl transition-all shadow-sm">
                {authMode === "login" ? "Ingresar y Guardar" : "Crear Perfil y Guardar"}
              </button>
            </form>

            <div className="text-center">
              <button
                onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
                className="text-xs text-slate-500 hover:text-slate-900 underline font-medium"
              >
                {authMode === "login" ? "¿Primera vez? Registrate acá" : "¿Ya tenés cuenta? Iniciar Sesión"}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500 bg-slate-50">
        <p>© {new Date().getFullYear()} Data eNe | Todos los derechos reservados. Prode Desarrollado por Muove Widgets.</p>
      </footer>
    </div>
  );
}
