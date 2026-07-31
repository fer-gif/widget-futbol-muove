"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toPng } from "html-to-image";
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

type EquipoTabla = {
  posicion: number;
  equipo: string;
  logo?: string;
  jugados: number;
  ganados: number;
  empatados: number;
  perdidos: number;
  golesFavor: number;
  golesContra: number;
  diferenciaGol: number;
  puntos: number;
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
  type Goleador = {
    posicion: number;
    nombre: string;
    equipo: string;
    logo: string;
    goles: number;
  };

  const [activeTab, setActiveTab] = useState<"fixture" | "ranking" | "amigos" | "info">("fixture");
  const [goleadoresList, setGoleadoresList] = useState<Goleador[]>([]);
  const [goleadoresPage, setGoleadoresPage] = useState<number>(1);
  const [downloadingGoleadoresImage, setDownloadingGoleadoresImage] = useState<boolean>(false);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [jornadas, setJornadas] = useState<string[]>([]);
  const [selectedJornada, setSelectedJornada] = useState<string>("");
  const [predictions, setPredictions] = useState<Record<string, { local: number; visitante: number }>>({});
  const [savedPredictions, setSavedPredictions] = useState<Record<string, { local: number; visitante: number }>>({});
  
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<"login" | "register" | "forgot">("login");
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
  const [downloadingImage, setDownloadingImage] = useState<boolean>(false);

  const [zonaA, setZonaA] = useState<EquipoTabla[]>([]);
  const [zonaB, setZonaB] = useState<EquipoTabla[]>([]);
  const [selectedZona, setSelectedZona] = useState<"A" | "B" | "GOLEADORES">("A");

  useEffect(() => {
    if (activeTab === "info") {
      fetchStandings();
      fetchGoleadores();
    }
  }, [activeTab]);

  // Asegurar fondo blanco en body para evitar cuadros negros si el iframe es más alto
  useEffect(() => {
    document.body.style.backgroundColor = "#ffffff";
    return () => {
      document.body.style.backgroundColor = "";
    };
  }, []);

  // Auto-resize para iFrame sin doble scroll
  useEffect(() => {
    const sendHeight = () => {
      if (typeof window !== "undefined") {
        const height = document.body.offsetHeight || document.documentElement.scrollHeight;
        window.parent.postMessage({ type: "prode-resize", height }, "*");
      }
    };

    sendHeight();
    const timeout = setTimeout(sendHeight, 300);

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => {
        sendHeight();
      });
      observer.observe(document.body);
      return () => {
        clearTimeout(timeout);
        observer.disconnect();
      };
    }

    return () => clearTimeout(timeout);
  }, [activeTab, selectedJornada, user, showAuthModal, showGroupModal, selectedZona, leaderboard, partidos]);

  async function handleDownloadTableImage() {
    const node = document.getElementById("standings-table-card");
    if (!node) return;
    setDownloadingImage(true);
    try {
      const dataUrl = await toPng(node, { cacheBust: true, pixelRatio: 2, backgroundColor: "#ffffff" });
      const link = document.createElement("a");
      link.download = `tabla-posiciones-zona-${selectedZona.toLowerCase()}-dataene.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Error al exportar tabla como imagen:", err);
    } finally {
      setDownloadingImage(false);
    }
  }

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
    if (user?.id) {
      fetchUserPredictions(user.id);
    } else {
      setSavedPredictions({});
    }
  }, [user?.id]);

  async function fetchUserPredictions(participanteId: string) {
    try {
      const res = await fetch(`/api/prode/predict?participante-id=${participanteId}`);
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.pronosticos)) {
        const savedMap: Record<string, { local: number; visitante: number }> = {};
        data.pronosticos.forEach((item: any) => {
          if (item.partido_id) {
            savedMap[item.partido_id] = {
              local: Number(item.goles_local_pred ?? item.goles_local_pronostico ?? 0),
              visitante: Number(item.goles_visitante_pred ?? item.goles_visitante_pronostico ?? 0),
            };
          }
        });
        setSavedPredictions(savedMap);
        setPredictions((prev) => ({ ...savedMap, ...prev }));

        if (typeof data.puntosTotales === "number") {
          setUser((prev) => {
            if (!prev || prev.puntos_totales === data.puntosTotales) return prev;
            const updated = { ...prev, puntos_totales: data.puntosTotales };
            try {
              localStorage.setItem(`prode_user_${clientId || "demo"}`, JSON.stringify(updated));
            } catch (e) {}
            return updated;
          });
        }
      }
    } catch (e) {}
  }

  useEffect(() => {
    if (activeTab === "ranking") {
      fetchLeaderboard();
    } else if (activeTab === "amigos") {
      if (user?.id) {
        fetchMyLeagues();
      }
    }
  }, [activeTab, activeLeagueId, user?.id]);

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
        if (user && data.ranking) {
          const me = data.ranking.find((r: any) => r.id === user.id);
          if (me && typeof me.puntos_totales === "number") {
            setUser((prev) => {
              if (!prev || prev.puntos_totales === me.puntos_totales) return prev;
              const updated = { ...prev, puntos_totales: me.puntos_totales };
              try {
                localStorage.setItem(`prode_user_${clientId || "demo"}`, JSON.stringify(updated));
              } catch (e) {}
              return updated;
            });
          }
        }
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

  async function savePredictionsWithUser(targetUser: User) {
    if (!targetUser) return;
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
          participanteId: targetUser.id,
          predictions: predictionsList,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSavedPredictions((prev) => ({ ...prev, ...predictions }));
        setProdeMsg({ type: "success", text: "¡Tus pronósticos se guardaron correctamente en DataeNe!" });
      } else {
        setProdeMsg({ type: "error", text: data.error || "La fecha se encuentra cerrada." });
      }
    } catch (e) {
      setProdeMsg({ type: "error", text: "Error de red al conectar con el servidor." });
    }
  }

  async function handleSavePredictions() {
    if (!user) {
      setShowAuthModal(true);
      setAuthMode("login");
      setAuthError("Ingresá o registrate con tu apodo para guardar tus pronósticos.");
      return;
    }
    await savePredictionsWithUser(user);
  }

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");

    try {
      const actionType = authMode === "forgot" ? "reset_pin" : authMode;
      const res = await fetch("/api/prode/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionType,
          clientId: clientId || "demo-client-id",
          email: authEmail,
          pin: authPin,
          nombre: authNombre,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const loggedUser = data.usuario;
        setUser(loggedUser);
        try {
          localStorage.setItem(`prode_user_${clientId || "demo"}`, JSON.stringify(loggedUser));
        } catch (e) {}
        setShowAuthModal(false);
        setAuthPin("");
        if (Object.keys(predictions).length > 0) {
          savePredictionsWithUser(loggedUser);
        }
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

  useEffect(() => {
    if (activeTab === "info") {
      fetchStandings();
      fetchGoleadores();
    }
  }, [activeTab]);

  async function fetchGoleadores() {
    try {
      const res = await fetch("/api/goleadores");
      const data = await res.json();
      if (res.ok && data.success) {
        setGoleadoresList(data.goleadores || []);
      }
    } catch (e) {}
  }

  async function handleDownloadGoleadoresImage() {
    const node = document.getElementById("goleadores-table-card");
    if (!node) return;
    setDownloadingGoleadoresImage(true);
    try {
      const dataUrl = await toPng(node, { cacheBust: true, pixelRatio: 2, backgroundColor: "#ffffff" });
      const link = document.createElement("a");
      link.download = `tabla-goleadores-liga-necochea-dataene.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Error al exportar tabla de goleadores:", err);
    } finally {
      setDownloadingGoleadoresImage(false);
    }
  }

  async function fetchStandings() {
    try {
      const res = await fetch("/api/prode/standings");
      const data = await res.json();
      if (res.ok && data.success) {
        setZonaA(data.zonaA || []);
        setZonaB(data.zonaB || []);
      }
    } catch (e) {}
  }

  const filteredPartidos = selectedJornada
    ? partidos.filter((p) => p.jornada === selectedJornada)
    : partidos;

  const goleadoresPerPage = 10;
  const totalGoleadoresPages = Math.ceil(goleadoresList.length / goleadoresPerPage) || 1;
  const paginatedGoleadores = goleadoresList.slice(
    (goleadoresPage - 1) * goleadoresPerPage,
    goleadoresPage * goleadoresPerPage
  );

  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans flex flex-col justify-between">
      <div className="bg-slate-50 border-b border-slate-200 py-2.5 px-4 text-center">
        <div className="max-w-3xl mx-auto space-y-0.5">
          <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">
            El PRODE de la <span className="text-[#EF426F]">Liga de Necochea</span>
          </h1>
          <p className="text-[11px] text-slate-600 max-w-xl mx-auto">
            Demostrá cuánto sabés del fútbol local. Arriesgá tus pronósticos cada fecha y competí en <strong className="text-slate-900">Data eNe</strong>.
          </p>
        </div>
      </div>

      <main className="max-w-5xl mx-auto w-full px-4 py-2 flex-grow">
        {/* Navigation Tabs Bar */}
        <div className="grid grid-cols-2 md:flex bg-[#7F35B2] p-1.5 mb-2.5 max-w-4xl mx-auto shadow-md rounded-xl gap-1">
          <button
            onClick={() => setActiveTab("fixture")}
            className={`md:flex-1 py-2.5 px-2 text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all text-center rounded-lg ${
              activeTab === "fixture" ? "bg-[#EF426F] text-white shadow-sm" : "text-white/80 hover:bg-[#EF426F]/40"
            }`}
          >
            ⚽ Pronósticos
          </button>
          <button
            onClick={() => setActiveTab("ranking")}
            className={`md:flex-1 py-2.5 px-2 text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all text-center rounded-lg ${
              activeTab === "ranking" ? "bg-[#EF426F] text-white shadow-sm" : "text-white/80 hover:bg-[#EF426F]/40"
            }`}
          >
            🏆 Posiciones DataeNe
          </button>
          <button
            onClick={() => setActiveTab("amigos")}
            className={`md:flex-1 py-2.5 px-2 text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all text-center rounded-lg ${
              activeTab === "amigos" ? "bg-[#EF426F] text-white shadow-sm" : "text-white/80 hover:bg-[#EF426F]/40"
            }`}
          >
            👥 Ligas de Amigos
          </button>
          <button
            onClick={() => setActiveTab("info")}
            className={`md:flex-1 py-2.5 px-2 text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all text-center rounded-lg ${
              activeTab === "info" ? "bg-[#EF426F] text-white shadow-sm" : "text-white/80 hover:bg-[#EF426F]/40"
            }`}
          >
            📊 Info del Torneo
          </button>
        </div>


        <div className="flex justify-center mb-3">
          {user ? (
            <div className="flex items-center gap-3 bg-slate-100 border border-slate-200 px-4 py-1.5 rounded-xl text-xs shadow-sm">
              <span className="font-extrabold text-slate-900">👤 {user.nombre}</span>
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
          <div className="space-y-3.5">
            {jornadas.length > 0 && (
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm flex-wrap gap-2">
                <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Jornada Activa:</span>
                <div className="flex gap-2 overflow-x-auto max-w-full">
                  {jornadas.map((j) => (
                    <button
                      key={j}
                      onClick={() => setSelectedJornada(j)}
                      className={`px-4 py-2 rounded text-xs font-black uppercase transition-colors shrink-0 ${
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
                className={`p-4 rounded-xl text-xs font-bold text-center border shadow-xs ${
                  prodeMsg.type === "success"
                    ? "bg-[#7F35B2]/10 border-[#7F35B2] text-[#7F35B2]"
                    : "bg-red-500/10 border-red-500/30 text-red-600"
                }`}
              >
                {prodeMsg.text}
              </div>
            )}

            {/* Banner Informativo de Cierre de Partidos Individuales */}
            {(() => {
              const totalP = filteredPartidos.length;
              const cerradosP = filteredPartidos.filter(p => {
                const matchTime = p.fecha_hora ? new Date(p.fecha_hora) : null;
                return p.estado_partido !== "programado" || (matchTime && !isNaN(matchTime.getTime()) && new Date() >= matchTime);
              }).length;

              if (totalP > 0 && cerradosP === totalP) {
                return (
                  <div className="bg-amber-500/10 border border-amber-500/30 text-amber-800 p-4 rounded-xl text-xs font-bold text-center">
                    🔒 La {selectedJornada || "fecha"} se encuentra cerrada. Todos los partidos han comenzado o finalizado.
                  </div>
                );
              } else if (cerradosP > 0) {
                return (
                  <div className="bg-sky-500/10 border border-sky-500/30 text-sky-800 p-4 rounded-xl text-xs font-bold text-center">
                    💡 Los partidos se cierran individualmente al comenzar. Hay {cerradosP} partido(s) cerrado(s) y {totalP - cerradosP} partido(s) disponible(s) para pronosticar.
                  </div>
                );
              }
              return null;
            })()}

            {/* Panel Resumen de Pronósticos Guardados para el usuario */}
            {user && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    📋 Mis Pronósticos Cargados ({selectedJornada || "Fecha"})
                  </span>
                  <span className="text-[11px] font-extrabold text-[#7F35B2] bg-[#7F35B2]/10 px-2.5 py-0.5 rounded-full">
                    {filteredPartidos.filter((p) => savedPredictions[p.id]).length} de {filteredPartidos.length} Cargados
                  </span>
                </div>

                <div className="flex gap-2 overflow-x-auto pt-1 no-scrollbar">
                  {filteredPartidos.map((p) => {
                    const saved = savedPredictions[p.id];
                    const isFin = p.estado_partido === "finalizado";
                    let ptsBadge = "";
                    let dotColor = saved ? "bg-emerald-500" : "bg-slate-300";

                    if (isFin && saved) {
                      const rL = Number(p.goles_local || 0);
                      const rV = Number(p.goles_visitante || 0);
                      if (saved.local === rL && saved.visitante === rV) {
                        ptsBadge = "🎯 +3 Pts";
                        dotColor = "bg-emerald-500 font-bold";
                      } else {
                        const pDiff = saved.local - saved.visitante;
                        const rDiff = rL - rV;
                        if ((pDiff > 0 && rDiff > 0) || (pDiff < 0 && rDiff < 0) || (pDiff === 0 && rDiff === 0)) {
                          ptsBadge = "✅ +1 Pt";
                          dotColor = "bg-green-500";
                        } else {
                          ptsBadge = "❌ 0 Pts";
                          dotColor = "bg-rose-400";
                        }
                      }
                    }

                    return (
                      <div
                        key={p.id}
                        className={`shrink-0 text-[11px] px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 border transition-all ${
                          saved
                            ? isFin
                              ? "bg-slate-100 border-slate-300 text-slate-800"
                              : "bg-emerald-50 border-emerald-200 text-emerald-800"
                            : "bg-white border-slate-200 text-slate-400"
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
                        <span className="font-extrabold">{p.equipo_local.nombre.split(" ")[0]}</span>
                        <span className="font-black text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-xs">
                          {saved ? `${saved.local} - ${saved.visitante}` : "VS"}
                        </span>
                        <span className="font-extrabold">{p.equipo_visitante.nombre.split(" ")[0]}</span>
                        {ptsBadge && <span className="text-[10px] font-black ml-1 text-[#EF426F]">{ptsBadge}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPartidos.map((p) => {
                const pred = predictions[p.id] || { local: 0, visitante: 0 };
                const saved = savedPredictions[p.id];

                const isFin = p.estado_partido === "finalizado";
                const isEnVivo = p.estado_partido === "en_vivo";
                const matchTime = p.fecha_hora ? new Date(p.fecha_hora) : null;
                const isHoraPasada = matchTime && !isNaN(matchTime.getTime()) && new Date() >= matchTime;
                const isBloqueado = Boolean(isFin || isEnVivo || isHoraPasada);

                const isSaved = saved && saved.local === pred.local && saved.visitante === pred.visitante;
                const isModified = saved && (saved.local !== pred.local || saved.visitante !== pred.visitante);

                // Cálculo de Puntos si el partido está finalizado
                let evalResult: { pts: number; label: string; style: string } | null = null;
                if (isFin && saved) {
                  const rL = Number(p.goles_local || 0);
                  const rV = Number(p.goles_visitante || 0);
                  if (saved.local === rL && saved.visitante === rV) {
                    evalResult = {
                      pts: 3,
                      label: "🎯 ¡ACERTASTE RESULTADO EXACTO! (+3 Pts)",
                      style: "bg-emerald-500/10 border-emerald-500 text-emerald-800 font-black",
                    };
                  } else {
                    const pDiff = saved.local - saved.visitante;
                    const rDiff = rL - rV;
                    if ((pDiff > 0 && rDiff > 0) || (pDiff < 0 && rDiff < 0) || (pDiff === 0 && rDiff === 0)) {
                      evalResult = {
                        pts: 1,
                        label: "✅ ACERTASTE GANADOR / EMPATE (+1 Pt)",
                        style: "bg-green-500/10 border-green-500 text-green-800 font-extrabold",
                      };
                    } else {
                      evalResult = {
                        pts: 0,
                        label: "❌ NO ACERTASTE EL RESULTADO (0 Pts)",
                        style: "bg-rose-50 border-rose-200 text-rose-700 font-bold",
                      };
                    }
                  }
                }

                return (
                  <div
                    key={p.id}
                    className={`bg-white border rounded-2xl p-4 sm:p-5 transition-all flex flex-col justify-between gap-3 shadow-sm ${
                      isFin
                        ? "border-slate-300 bg-slate-50/50"
                        : isSaved
                        ? "border-emerald-200 hover:border-emerald-400"
                        : "border-slate-200 hover:border-[#EF426F]"
                    }`}
                  >
                    {/* Header con Liga, Día/Hora y Jornada */}
                    <div className="flex justify-between items-center text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2.5 gap-2 flex-wrap">
                      <span className="truncate max-w-[140px] sm:max-w-none">{p.liga_nombre}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-extrabold text-[10px]">
                          🕒 {formatFechaHora(p.fecha_hora)}
                        </span>
                        <span className="bg-[#EF426F] text-white px-2 py-0.5 rounded font-extrabold text-[10px]">
                          {p.jornada}
                        </span>
                      </div>
                    </div>

                    {/* Equipos y Controles de Goles en Grid Relativo 3 - 1 - 3 */}
                    <div className="grid grid-cols-7 items-center gap-1 sm:gap-3 py-2">
                      {/* Local Team */}
                      <div className="col-span-3 flex flex-col items-center gap-1.5 text-center">
                        <img src={p.equipo_local.logo || "https://placehold.co/40/121214/fff?text=L"} alt="" className="w-12 h-12 sm:w-14 sm:h-14 object-contain drop-shadow" />
                        <span className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-tight line-clamp-2 leading-tight h-7 flex items-center justify-center">
                          {p.equipo_local.nombre}
                        </span>
                        
                        <div className="flex items-center gap-1 sm:gap-2 bg-slate-50 border border-slate-200 p-1 rounded-xl">
                          <button
                            disabled={isBloqueado}
                            onClick={() => handleScoreChange(p.id, "local", -1)}
                            className={`w-7 h-7 sm:w-8 sm:h-8 bg-white border border-slate-200 text-slate-800 font-extrabold rounded text-sm flex items-center justify-center transition-colors shadow-xs ${
                              isBloqueado ? "opacity-40 cursor-not-allowed" : "hover:bg-[#EF426F] hover:text-white"
                            }`}
                          >
                            -
                          </button>
                          <span className="w-5 sm:w-6 text-center font-black text-sm sm:text-base text-[#EF426F]">
                            {isFin ? (saved ? saved.local : pred.local) : pred.local}
                          </span>
                          <button
                            disabled={isBloqueado}
                            onClick={() => handleScoreChange(p.id, "local", 1)}
                            className={`w-7 h-7 sm:w-8 sm:h-8 bg-white border border-slate-200 text-slate-800 font-extrabold rounded text-sm flex items-center justify-center transition-colors shadow-xs ${
                              isBloqueado ? "opacity-40 cursor-not-allowed" : "hover:bg-[#EF426F] hover:text-white"
                            }`}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* VS Divider / Resultado Real */}
                      <div className="col-span-1 flex flex-col items-center justify-center text-center">
                        {isFin ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase">FINAL</span>
                            <span className="font-black text-sm sm:text-base bg-[#7F35B2] text-white px-2 py-1 rounded-lg shadow-xs">
                              {p.goles_local} - {p.goles_visitante}
                            </span>
                          </div>
                        ) : isEnVivo ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[9px] font-black text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded animate-pulse">EN VIVO</span>
                            <span className="font-black text-slate-400 text-xs sm:text-sm">VS</span>
                          </div>
                        ) : (
                          <span className="font-black text-slate-400 text-xs sm:text-sm bg-slate-100 px-2 py-1 rounded-full border border-slate-200 shadow-xs">
                            VS
                          </span>
                        )}
                      </div>

                      {/* Visitante Team */}
                      <div className="col-span-3 flex flex-col items-center gap-1.5 text-center">
                        <img src={p.equipo_visitante.logo || "https://placehold.co/40/121214/fff?text=V"} alt="" className="w-12 h-12 sm:w-14 sm:h-14 object-contain drop-shadow" />
                        <span className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-tight line-clamp-2 leading-tight h-7 flex items-center justify-center">
                          {p.equipo_visitante.nombre}
                        </span>
                        
                        <div className="flex items-center gap-1 sm:gap-2 bg-slate-50 border border-slate-200 p-1 rounded-xl">
                          <button
                            disabled={isBloqueado}
                            onClick={() => handleScoreChange(p.id, "visitante", -1)}
                            className={`w-7 h-7 sm:w-8 sm:h-8 bg-white border border-slate-200 text-slate-800 font-extrabold rounded text-sm flex items-center justify-center transition-colors shadow-xs ${
                              isBloqueado ? "opacity-40 cursor-not-allowed" : "hover:bg-[#EF426F] hover:text-white"
                            }`}
                          >
                            -
                          </button>
                          <span className="w-5 sm:w-6 text-center font-black text-sm sm:text-base text-[#EF426F]">
                            {isFin ? (saved ? saved.visitante : pred.visitante) : pred.visitante}
                          </span>
                          <button
                            disabled={isBloqueado}
                            onClick={() => handleScoreChange(p.id, "visitante", 1)}
                            className={`w-7 h-7 sm:w-8 sm:h-8 bg-white border border-slate-200 text-slate-800 font-extrabold rounded text-sm flex items-center justify-center transition-colors shadow-xs ${
                              isBloqueado ? "opacity-40 cursor-not-allowed" : "hover:bg-[#EF426F] hover:text-white"
                            }`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Estado del Pronóstico y Evaluación de Puntos */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-extrabold">
                      {isFin ? (
                        evalResult ? (
                          <div className={`w-full p-2 rounded-xl text-center flex flex-col gap-0.5 border ${evalResult.style}`}>
                            <span className="text-[11px]">{evalResult.label}</span>
                            <span className="text-[10px] font-medium text-slate-600">
                              Tu pronóstico: <strong>{saved.local} - {saved.visitante}</strong> | Resultado real: <strong>{p.goles_local} - {p.goles_visitante}</strong>
                            </span>
                          </div>
                        ) : (
                          <div className="w-full p-2 rounded-xl text-center bg-slate-100 text-slate-500 font-semibold border border-slate-200">
                            🏁 Partido Finalizado ({p.goles_local} - {p.goles_visitante}) — No habías cargado pronóstico
                          </div>
                        )
                      ) : isBloqueado ? (
                        <div className="w-full p-2 rounded-xl text-center bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                          🔒 Partido Cerrado {saved ? `(Tu pronóstico: ${saved.local} - ${saved.visitante})` : "(Sin pronóstico cargado)"}
                        </div>
                      ) : isSaved ? (
                        <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1 w-full justify-center">
                          ✅ Pronóstico Guardado: {saved.local} - {saved.visitante}
                        </span>
                      ) : isModified ? (
                        <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg flex items-center gap-1 w-full justify-center">
                          ⚠️ Cambios sin guardar (Guardá abajo)
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal text-center w-full">
                          Sin pronóstico guardado aún
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-center pt-2 px-2">
              <button
                onClick={handleSavePredictions}
                className="w-full max-w-md bg-[#EF426F] hover:bg-[#d83760] text-white font-black text-xs sm:text-sm py-3.5 px-6 rounded-2xl shadow-xl transition-all border border-white/20 active:scale-95"
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
                    💬 Invitar Amigos por WhatsApp
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
              <h2 className="text-lg font-black text-slate-900">Armá tu Liga de Amigos en DataeNe</h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Desafía a tus amigos fecha a fecha para ver quien sabe más del fútbol necochense.
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
                          💬 Invitar
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

        {/* TAB 4: INFO DEL TORNEO (TABLAS OFICIALES DE POSICIONES Y GOLEADORES) */}
        {activeTab === "info" && (
          <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header & Selector de Tablas (Zona A, Zona B, Goleadores) */}
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl p-4 flex-wrap gap-4 shadow-sm">
              <div>
                <h2 className="text-base font-black text-slate-900">
                  {selectedZona === "GOLEADORES"
                    ? "Tabla Oficial de Goleadores"
                    : `Tablas Oficiales de Posiciones - Zona ${selectedZona}`}
                </h2>
                <p className="text-xs text-slate-500">Liga Necochea de Fútbol - Torneo Oficial de Primera</p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setSelectedZona("A")}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                    selectedZona === "A"
                      ? "bg-[#EF426F] text-white shadow-sm"
                      : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  ZONA A
                </button>
                <button
                  onClick={() => setSelectedZona("B")}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                    selectedZona === "B"
                      ? "bg-[#EF426F] text-white shadow-sm"
                      : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  ZONA B
                </button>
                <button
                  onClick={() => setSelectedZona("GOLEADORES")}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                    selectedZona === "GOLEADORES"
                      ? "bg-[#EF426F] text-white shadow-sm"
                      : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  GOLEADORES
                </button>
              </div>
            </div>

            {/* SI SELECCIONA ZONA A O ZONA B -> MUESTRA TABLA DE POSICIONES */}
            {(selectedZona === "A" || selectedZona === "B") && (
              <div className="space-y-3">
                <div id="standings-table-card" className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm p-1">
                  {/* Header Banner con el Logo Oficial de DataeNe */}
                  <div className="bg-white px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src="https://dataene.com.ar/uploads/cliente/marca/20210210092501_positivo-horizontal-2x.png"
                        alt="Data eNe"
                        className="h-8 object-contain"
                      />
                      <div>
                        <h3 className="font-black text-sm text-slate-900 uppercase">
                          TABLA DE POSICIONES - ZONA {selectedZona}
                        </h3>
                        <p className="text-[10px] text-slate-500 font-extrabold uppercase">
                          Liga Necochea de Fútbol - Torneo Oficial de Primera
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                          <th className="py-3 px-4 text-center w-10">#</th>
                          <th className="py-3 px-4">EQUIPO</th>
                          <th className="py-3 px-2 text-center">J</th>
                          <th className="py-3 px-2 text-center">G</th>
                          <th className="py-3 px-2 text-center">E</th>
                          <th className="py-3 px-2 text-center">P</th>
                          <th className="py-3 px-2 text-center">GF</th>
                          <th className="py-3 px-2 text-center">GC</th>
                          <th className="py-3 px-2 text-center">DIF</th>
                          <th className="py-3 px-4 text-center bg-[#EF426F]/10 text-[#EF426F]">PTS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        {(selectedZona === "A" ? zonaA : zonaB).map((item, idx) => (
                          <tr
                            key={item.equipo}
                            className={`hover:bg-slate-50 transition-colors ${
                              idx < 4 ? "bg-emerald-50/30" : ""
                            }`}
                          >
                            <td className="py-3 px-4 text-center font-black text-slate-400">
                              {item.posicion}
                            </td>
                            <td className="py-3 px-4 font-black text-slate-900 flex items-center gap-2">
                              {item.logo && (
                                <img src={item.logo} alt="" className="w-6 h-6 object-contain" />
                              )}
                              <span>{item.equipo}</span>
                            </td>
                            <td className="py-3 px-2 text-center font-semibold">{item.jugados}</td>
                            <td className="py-3 px-2 text-center font-semibold text-emerald-600">{item.ganados}</td>
                            <td className="py-3 px-2 text-center font-semibold text-amber-600">{item.empatados}</td>
                            <td className="py-3 px-2 text-center font-semibold text-rose-600">{item.perdidos}</td>
                            <td className="py-3 px-2 text-center text-slate-600">{item.golesFavor}</td>
                            <td className="py-3 px-2 text-center text-slate-600">{item.golesContra}</td>
                            <td className={`py-3 px-2 text-center font-bold ${item.diferenciaGol > 0 ? "text-emerald-600" : item.diferenciaGol < 0 ? "text-rose-600" : "text-slate-500"}`}>
                              {item.diferenciaGol > 0 ? `+${item.diferenciaGol}` : item.diferenciaGol}
                            </td>
                            <td className="py-3 px-4 text-center font-black text-sm text-[#EF426F] bg-[#EF426F]/5">
                              {item.puntos}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Botón de Descarga Imagen PNG de Posiciones */}
                <div className="flex justify-end pt-1">
                  <button
                    onClick={handleDownloadTableImage}
                    disabled={downloadingImage}
                    className="bg-[#7F35B2] hover:bg-[#6b2a99] text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase transition-all shadow-sm active:scale-95 disabled:opacity-50"
                  >
                    {downloadingImage ? "Generando..." : "Descargar Tabla de Posiciones (PNG)"}
                  </button>
                </div>
              </div>
            )}

            {/* SI SELECCIONA GOLEADORES -> MUESTRA TABLA DE GOLEADORES (ESTILO UNIFICADO CON POSICIONES) */}
            {selectedZona === "GOLEADORES" && (
              <div className="space-y-3">
                <div id="goleadores-table-card" className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm p-1">
                  {/* Header Banner con Logo Data eNe */}
                  <div className="bg-white px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src="https://dataene.com.ar/uploads/cliente/marca/20210210092501_positivo-horizontal-2x.png"
                        alt="Data eNe"
                        className="h-8 object-contain"
                      />
                      <div>
                        <h3 className="font-black text-sm text-slate-900 uppercase">
                          TABLA OFICIAL DE GOLEADORES
                        </h3>
                        <p className="text-[10px] text-slate-500 font-extrabold uppercase">
                          Liga Necochea de Fútbol - Torneo Oficial de Primera
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                          <th className="py-3 px-4 text-center w-12">#</th>
                          <th className="py-3 px-4">JUGADOR</th>
                          <th className="py-3 px-4">EQUIPO</th>
                          <th className="py-3 px-4 text-center bg-[#EF426F]/10 text-[#EF426F] w-24">GOLES</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        {paginatedGoleadores.map((item) => (
                          <tr
                            key={item.nombre + item.equipo}
                            className={`hover:bg-slate-50 transition-colors ${
                              item.posicion === 1
                                ? "bg-amber-50/40 font-bold"
                                : item.posicion === 2
                                ? "bg-slate-50/60"
                                : item.posicion === 3
                                ? "bg-orange-50/30"
                                : ""
                            }`}
                          >
                            <td className="py-3 px-4 text-center font-black text-slate-400">
                              {item.posicion === 1 ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-400 text-amber-950 text-xs shadow-xs">
                                  🥇
                                </span>
                              ) : item.posicion === 2 ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-800 text-xs">
                                  🥈
                                </span>
                              ) : item.posicion === 3 ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-600/20 text-amber-900 text-xs">
                                  🥉
                                </span>
                              ) : (
                                item.posicion
                              )}
                            </td>
                            <td className="py-3 px-4 font-black text-slate-900 text-xs md:text-sm">
                              {item.nombre}
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-700 flex items-center gap-2">
                              {item.logo && (
                                <img
                                  src={item.logo}
                                  alt=""
                                  className="w-6 h-6 object-contain shrink-0"
                                />
                              )}
                              <span>{item.equipo}</span>
                            </td>
                            <td className="py-3 px-4 text-center font-black text-sm text-[#EF426F] bg-[#EF426F]/5">
                              {item.goles}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Paginación y Botón de Descarga Imagen PNG */}
                <div className="flex items-center justify-between pt-1 flex-wrap gap-3">
                  {/* Botones de Paginación */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setGoleadoresPage((p) => Math.max(1, p - 1))}
                      disabled={goleadoresPage === 1}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-black uppercase text-slate-700 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
                    >
                      ◄ Anterior
                    </button>
                    <span className="text-xs font-black text-slate-600 px-1">
                      Página {goleadoresPage} de {totalGoleadoresPages}
                    </span>
                    <button
                      onClick={() => setGoleadoresPage((p) => Math.min(totalGoleadoresPages, p + 1))}
                      disabled={goleadoresPage === totalGoleadoresPages}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-black uppercase text-slate-700 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
                    >
                      Siguiente ►
                    </button>
                  </div>

                  {/* Botón Descargar PNG */}
                  <button
                    onClick={handleDownloadGoleadoresImage}
                    disabled={downloadingGoleadoresImage}
                    className="bg-[#7F35B2] hover:bg-[#6b2a99] text-white px-5 py-2 rounded-xl text-xs font-black uppercase transition-all shadow-sm active:scale-95 disabled:opacity-50"
                  >
                    {downloadingGoleadoresImage
                      ? "Generando..."
                      : "Descargar Tabla de Goleadores (PNG)"}
                  </button>
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
                {authMode === "login" ? "Ingresá a tu Cuenta" : authMode === "register" ? "Creá tu Perfil de Jugador" : "Restablecer tu PIN"}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {authMode === "login"
                  ? "Ingresá tu Email y tu PIN de 4 números."
                  : authMode === "register"
                  ? "Elegí tu apodo y PIN para guardar tus puntos."
                  : "Ingresá tu Email registrado y definí un nuevo PIN de 4 números."}
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
                placeholder={authMode === "forgot" ? "Nuevo PIN de 4 números (ej. 1234)" : "PIN de 4 números (ej. 1234)"}
                value={authPin}
                onChange={(e) => setAuthPin(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-900 outline-none focus:border-[#EF426F]"
              />

              <button type="submit" className="w-full bg-[#EF426F] hover:bg-[#d83760] text-white font-extrabold text-xs py-3.5 rounded-xl transition-all shadow-sm">
                {authMode === "login" ? "Ingresar y Guardar" : authMode === "register" ? "Crear Perfil y Guardar" : "Restablecer PIN e Ingresar"}
              </button>
            </form>

            <div className="text-center space-y-2 pt-2 border-t border-slate-100 flex flex-col items-center">
              {authMode === "login" && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("forgot");
                      setAuthError("");
                    }}
                    className="text-xs text-slate-500 hover:text-[#EF426F] font-semibold underline"
                  >
                    ¿Olvidaste tu PIN? Restablecelo acá
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("register");
                      setAuthError("");
                    }}
                    className="text-xs text-slate-500 hover:text-slate-900 font-medium underline"
                  >
                    ¿Primera vez? Registrate acá
                  </button>
                </>
              )}

              {authMode === "register" && (
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setAuthError("");
                  }}
                  className="text-xs text-slate-500 hover:text-slate-900 font-medium underline"
                >
                  ¿Ya tenés cuenta? Iniciar Sesión
                </button>
              )}

              {authMode === "forgot" && (
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setAuthError("");
                  }}
                  className="text-xs text-slate-500 hover:text-slate-900 font-medium underline"
                >
                  ← Volver a Iniciar Sesión
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500 bg-slate-50 flex flex-col sm:flex-row items-center justify-center gap-2">
        <span>© {new Date().getFullYear()} Data eNe | Todos los derechos reservados. Prode Desarrollado por</span>
        <a
          href="https://agenciamuove.com/#servicios"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center hover:opacity-80 transition-opacity"
          title="Agencia Muove"
        >
          <img src="/logo_muove.svg" alt="Muove" className="h-4 w-auto object-contain" />
        </a>
      </footer>
    </div>
  );
}
