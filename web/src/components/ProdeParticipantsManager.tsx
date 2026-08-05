"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";

type Participante = {
  id: string;
  nombre: string;
  email: string;
  puntos_totales: number;
  racha_actual: number;
  cliente_id: string;
  nombre_medio?: string;
  created_at: string;
  total_pronosticos: number;
};

type ClienteOption = {
  id: string;
  nombre_medio: string;
};

interface ProdeParticipantsManagerProps {
  isSuperAdmin?: boolean;
  defaultClientId?: string;
  clientesList?: ClienteOption[];
}

export default function ProdeParticipantsManager({
  isSuperAdmin = false,
  defaultClientId,
  clientesList = [],
}: ProdeParticipantsManagerProps) {
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>(
    defaultClientId || "todos"
  );
  const [filterActividad, setFilterActividad] = useState<
    "todos" | "con_pronosticos" | "sin_pronosticos" | "top_puntos"
  >("todos");
  const [sortBy, setSortBy] = useState<"puntos" | "fecha" | "nombre">("puntos");

  // Notificación / Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Plantilla de Recordatorio
  const [selectedTemplate, setSelectedTemplate] = useState<
    "proxima_fecha" | "ranking_posiciones" | "cierre_urgente" | "personalizado"
  >("proxima_fecha");

  const [customSubject, setCustomSubject] = useState(
    "🏆 ¡No te olvides de jugar la próxima fecha del Prode!"
  );
  const [customBody, setCustomBody] = useState(
    `¡Hola! ⚽\n\nTe recordamos que ya podés ingresar a cargar o modificar tus pronósticos para la próxima fecha del Prode.\n\n🏆 No te quedes afuera y sumá puntos para escalar en la tabla de posiciones.\n\n👉 Ingresá ahora: https://widget-futbol-muove.vercel.app/prode\n\n¡Buena suerte!`
  );

  // Modal confirmación de borrado
  const [deleteCandidate, setDeleteCandidate] = useState<Participante | null>(
    null
  );

  useEffect(() => {
    fetchParticipantes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId]);

  async function fetchParticipantes() {
    setLoading(true);
    setError(null);
    try {
      let url = "/api/prode/participants";
      if (selectedClientId && selectedClientId !== "todos") {
        url += `?client-id=${selectedClientId}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        setParticipantes(data.participantes || []);
      } else {
        // Fallback a consulta direct supabase si la API no estuviera disponible
        let query = supabase
          .from("prode_participantes")
          .select(
            "id, nombre, email, puntos_totales, racha_actual, cliente_id, created_at, clientes(nombre_medio)"
          );

        if (selectedClientId && selectedClientId !== "todos") {
          query = query.eq("cliente_id", selectedClientId);
        }

        const { data: directData, error: directErr } = await query.order(
          "created_at",
          { ascending: false }
        );

        if (directErr) throw directErr;

        const formatted = (directData || []).map((p: any) => ({
          id: p.id,
          nombre: p.nombre,
          email: p.email,
          puntos_totales: p.puntos_totales || 0,
          racha_actual: p.racha_actual || 0,
          cliente_id: p.cliente_id,
          nombre_medio: p.clientes?.nombre_medio || "General / Muove",
          created_at: p.created_at,
          total_pronosticos: 0,
        }));
        setParticipantes(formatted);
      }
    } catch (err: any) {
      console.error("Error al cargar participantes:", err);
      setError(err.message || "Error al cargar la lista de participantes");
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  }

  // Actualizar plantilla de mensaje según selección
  function handleSelectTemplate(
    type: "proxima_fecha" | "ranking_posiciones" | "cierre_urgente" | "personalizado"
  ) {
    setSelectedTemplate(type);
    if (type === "proxima_fecha") {
      setCustomSubject("🏆 ¡No te olvides de jugar la próxima fecha del Prode!");
      setCustomBody(
        `¡Hola! ⚽\n\nTe recordamos que ya podés ingresar a cargar o modificar tus pronósticos para la próxima fecha del Prode.\n\n🏆 No te quedes afuera y sumá puntos para escalar en la tabla de posiciones.\n\n👉 Ingresá ahora: https://widget-futbol-muove.vercel.app/prode\n\n¡Buena suerte!`
      );
    } else if (type === "ranking_posiciones") {
      setCustomSubject("📊 ¡Actualizamos la Tabla de Posiciones del Prode!");
      setCustomBody(
        `¡Hola! 🔥\n\nYa están calculados los puntos de los últimos partidos del Prode.\n\n📊 Ingresá a la plataforma para ver en qué posición quedaste y cuántos puntos sumaste en la fecha.\n\n👉 Consultá el ranking: https://widget-futbol-muove.vercel.app/prode\n\n¡Seguí jugando!`
      );
    } else if (type === "cierre_urgente") {
      setCustomSubject("⏳ ¡Últimas horas para cargar tus pronósticos del Prode!");
      setCustomBody(
        `¡Atención! ⚠️\n\nFaltan muy pocas horas para que comiencen los partidos de la fecha. Si no cargás tus resultados te vas a perder los puntos.\n\n⚡ Entrá ahora mismo y completá tu prode:\n👉 https://widget-futbol-muove.vercel.app/prode\n\n¡Apurate!`
      );
    }
  }

  // Filtrado y ordenamiento de lista
  const filteredParticipantes = useMemo(() => {
    return participantes
      .filter((p) => {
        // Búsqueda por texto (nombre o email)
        const matchSearch =
          p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (p.nombre_medio &&
            p.nombre_medio.toLowerCase().includes(searchTerm.toLowerCase()));

        if (!matchSearch) return false;

        // Filtro de Actividad
        if (filterActividad === "con_pronosticos" && p.total_pronosticos === 0) {
          return false;
        }
        if (filterActividad === "sin_pronosticos" && p.total_pronosticos > 0) {
          return false;
        }
        if (filterActividad === "top_puntos" && p.puntos_totales === 0) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "puntos") {
          return b.puntos_totales - a.puntos_totales;
        }
        if (sortBy === "nombre") {
          return a.nombre.localeCompare(b.nombre);
        }
        if (sortBy === "fecha") {
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        }
        return 0;
      });
  }, [participantes, searchTerm, filterActividad, sortBy]);

  // Lista de mails únicos filtrados
  const emailsFiltrados = useMemo(() => {
    const setMails = new Set<string>();
    filteredParticipantes.forEach((p) => {
      if (p.email && p.email.includes("@")) {
        setMails.add(p.email.trim());
      }
    });
    return Array.from(setMails);
  }, [filteredParticipantes]);

  // KPIs
  const totalUsuarios = participantes.length;
  const totalEmails = new Set(participantes.map((p) => p.email)).size;
  const totalPronosticosSum = participantes.reduce(
    (acc, p) => acc + (p.total_pronosticos || 0),
    0
  );
  const promedioPuntos =
    totalUsuarios > 0
      ? (
          participantes.reduce((acc, p) => acc + (p.puntos_totales || 0), 0) /
          totalUsuarios
        ).toFixed(1)
      : "0";

  // Acciones de Copiado / Mail
  function handleCopyAllEmails() {
    if (emailsFiltrados.length === 0) {
      showToast("⚠️ No hay emails en la lista actual.");
      return;
    }
    const mailListStr = emailsFiltrados.join(", ");
    navigator.clipboard.writeText(mailListStr);
    showToast(
      `📋 ¡${emailsFiltrados.length} emails copiados al portapapeles! Listo para pegar en CCO/BCC.`
    );
  }

  function handleOpenBulkMailto() {
    if (emailsFiltrados.length === 0) {
      showToast("⚠️ No hay destinatarios seleccionados.");
      return;
    }
    const bccList = emailsFiltrados.join(",");
    const mailtoUrl = `mailto:?bcc=${encodeURIComponent(
      bccList
    )}&subject=${encodeURIComponent(customSubject)}&body=${encodeURIComponent(
      customBody
    )}`;
    window.open(mailtoUrl, "_blank");
  }

  function handleCopyMessageForWhatsApp() {
    const formatted = `*${customSubject}*\n\n${customBody}`;
    navigator.clipboard.writeText(formatted);
    showToast("🟢 ¡Mensaje copiado! Listo para pegar en WhatsApp o Telegram.");
  }

  function handleExportCSV() {
    if (filteredParticipantes.length === 0) {
      showToast("⚠️ No hay datos para exportar.");
      return;
    }

    const headers = [
      "ID",
      "Nombre de Usuario",
      "Email",
      "Diario / Medio",
      "Puntos Totales",
      "Racha Actual",
      "Pronosticos Cargados",
      "Fecha de Registro",
    ];

    const rows = filteredParticipantes.map((p) => [
      `"${p.id}"`,
      `"${p.nombre.replace(/"/g, '""')}"`,
      `"${p.email.replace(/"/g, '""')}"`,
      `"${(p.nombre_medio || "General").replace(/"/g, '""')}"`,
      p.puntos_totales,
      p.racha_actual,
      p.total_pronosticos,
      `"${new Date(p.created_at).toLocaleDateString("es-AR")}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(";"), ...rows.map((e) => e.join(";"))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `usuarios_prode_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("📥 Archivo CSV descargado correctamente.");
  }

  async function handleDeleteParticipant(id: string) {
    try {
      const res = await fetch(`/api/prode/participants?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setParticipantes((prev) => prev.filter((p) => p.id !== id));
        showToast("🗑️ Participante eliminado con éxito.");
      } else {
        alert("Error al eliminar: " + data.error);
      }
    } catch (err: any) {
      alert("Error de conexión: " + err.message);
    } finally {
      setDeleteCandidate(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#00E676] text-black font-bold text-xs py-3 px-5 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce border border-white/20">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER PRINCIPAL */}
      <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-[#ff7900]/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🏆</span>
              <h2 className="text-xl font-bold text-white tracking-wide">
                Gestión de Participantes del Prode
              </h2>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Consulta nombres de usuario, emails y envía mensajes de
              recordatorio para que no olviden jugar.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={fetchParticipantes}
              disabled={loading}
              className="bg-[#09090b] hover:bg-zinc-800 text-zinc-300 border border-[#27272a] font-semibold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5"
            >
              🔄 Refresh Datos
            </button>
            <button
              onClick={handleExportCSV}
              className="bg-[#09090b] hover:bg-zinc-800 text-green-400 border border-green-500/20 font-semibold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5"
            >
              📥 Exportar Excel (CSV)
            </button>
          </div>
        </div>

        {/* METRICAS KPI CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#09090b] border border-[#27272a] p-4 rounded-xl">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
              Participantes Registrados
            </span>
            <div className="text-2xl font-black text-white mt-1">
              {totalUsuarios}
            </div>
            <span className="text-[10px] text-zinc-400">
              Cuentas creadas en el prode
            </span>
          </div>

          <div className="bg-[#09090b] border border-[#27272a] p-4 rounded-xl">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
              Emails Únicos
            </span>
            <div className="text-2xl font-black text-[#ff7900] mt-1">
              {totalEmails}
            </div>
            <span className="text-[10px] text-zinc-400">
              Directorio para remisión
            </span>
          </div>

          <div className="bg-[#09090b] border border-[#27272a] p-4 rounded-xl">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
              Pronósticos Cargados
            </span>
            <div className="text-2xl font-black text-blue-400 mt-1">
              {totalPronosticosSum}
            </div>
            <span className="text-[10px] text-zinc-400">
              Predicciones enviadas
            </span>
          </div>

          <div className="bg-[#09090b] border border-[#27272a] p-4 rounded-xl">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
              Promedio de Puntos
            </span>
            <div className="text-2xl font-black text-green-400 mt-1">
              {promedioPuntos} pts
            </div>
            <span className="text-[10px] text-zinc-400">
              Por usuario registrado
            </span>
          </div>
        </div>
      </div>

      {/* SECCIÓN CENTRO DE REMISIÓN / RECORDATORIOS */}
      <div className="bg-[#121214] border border-[#ff7900]/30 rounded-2xl p-6 relative">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 pb-4 border-b border-[#27272a]">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>📣</span> Enviar Recordatorio para Jugar al Prode
            </h3>
            <p className="text-xs text-zinc-400">
              Seleccioná una plantilla pre-diseñada o redactá un mensaje para
              difundir por Email o WhatsApp a los {emailsFiltrados.length}{" "}
              usuarios filtrados.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCopyAllEmails}
              className="bg-[#ff7900] hover:bg-[#e06b00] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-[#ff7900]/20 transition-all flex items-center gap-1.5"
            >
              📋 Copiar Mails Filtrados ({emailsFiltrados.length})
            </button>
            <button
              onClick={handleOpenBulkMailto}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center gap-1.5"
            >
              ✉️ Enviar Correo (CCO/BCC)
            </button>
          </div>
        </div>

        {/* Seleccionar Plantilla */}
        <div className="space-y-4">
          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
            Plantillas de Mensaje Rápidas:
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => handleSelectTemplate("proxima_fecha")}
              className={`p-3 rounded-xl border text-left text-xs transition-all ${
                selectedTemplate === "proxima_fecha"
                  ? "bg-[#ff7900]/10 border-[#ff7900] text-white font-bold"
                  : "bg-[#09090b] border-[#27272a] text-zinc-400 hover:text-white"
              }`}
            >
              <div className="font-bold">⏰ Próxima Fecha</div>
              <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                Recordatorio de carga de marcadores
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTemplate("ranking_posiciones")}
              className={`p-3 rounded-xl border text-left text-xs transition-all ${
                selectedTemplate === "ranking_posiciones"
                  ? "bg-[#ff7900]/10 border-[#ff7900] text-white font-bold"
                  : "bg-[#09090b] border-[#27272a] text-zinc-400 hover:text-white"
              }`}
            >
              <div className="font-bold">📊 Posiciones / Tabla</div>
              <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                Notificación de cálculo de puntos
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTemplate("cierre_urgente")}
              className={`p-3 rounded-xl border text-left text-xs transition-all ${
                selectedTemplate === "cierre_urgente"
                  ? "bg-[#ff7900]/10 border-[#ff7900] text-white font-bold"
                  : "bg-[#09090b] border-[#27272a] text-zinc-400 hover:text-white"
              }`}
            >
              <div className="font-bold">⏳ Cierre Inminente</div>
              <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                Alerta antes del pitazo inicial
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleSelectTemplate("personalizado")}
              className={`p-3 rounded-xl border text-left text-xs transition-all ${
                selectedTemplate === "personalizado"
                  ? "bg-[#ff7900]/10 border-[#ff7900] text-white font-bold"
                  : "bg-[#09090b] border-[#27272a] text-zinc-400 hover:text-white"
              }`}
            >
              <div className="font-bold">✏️ Personalizado</div>
              <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                Escribir mensaje libre
              </div>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">
                Asunto del Email
              </label>
              <input
                type="text"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#ff7900]/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">
                Acciones de Difusión Rápidas
              </label>
              <div className="flex gap-2">
                <button
                  onClick={handleCopyMessageForWhatsApp}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 px-3 rounded-xl transition-all flex justify-center items-center gap-1.5 shadow-lg shadow-emerald-600/10"
                >
                  🟢 Copiar para WhatsApp / Difusión
                </button>

                <button
                  onClick={handleOpenBulkMailto}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-2.5 px-3 rounded-xl transition-all flex justify-center items-center gap-1.5 shadow-lg shadow-blue-600/10"
                >
                  ✉️ Abrir Cliente Mail
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1">
              Cuerpo del Mensaje (Soporta Emojis y Links)
            </label>
            <textarea
              rows={4}
              value={customBody}
              onChange={(e) => setCustomBody(e.target.value)}
              className="w-full bg-[#09090b] border border-[#27272a] rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#ff7900]/50 font-sans"
            />
          </div>
        </div>
      </div>

      {/* SECCIÓN FILTROS Y BUSQUEDA */}
      <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Buscador */}
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">
              🔍 Buscar por Nombre o Email
            </label>
            <input
              type="text"
              placeholder="Ej. Juan Pérez o juan@gmail.com..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#ff7900]/50"
            />
          </div>

          {/* Filtro por Diario si aplica */}
          {(isSuperAdmin || clientesList.length > 0) && (
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">
                📰 Diario / Medio
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#ff7900]/50 font-semibold"
              >
                <option value="todos">🌐 Todos los Medios</option>
                {clientesList.map((c) => (
                  <option key={c.id} value={c.id}>
                    📰 {c.nombre_medio}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Ordenar por */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">
              ↕️ Ordenar por
            </label>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#ff7900]/50 font-semibold"
            >
              <option value="puntos">🏆 Puntos (Ranking)</option>
              <option value="fecha">📅 Registro (Más Reciente)</option>
              <option value="nombre">🔤 Nombre (A - Z)</option>
            </select>
          </div>
        </div>

        {/* Botones de Filtro Actividad */}
        <div className="flex flex-wrap gap-2 pt-1 border-t border-[#27272a]/50">
          <span className="text-xs text-zinc-500 font-bold self-center mr-2">
            Filtrar:
          </span>
          <button
            onClick={() => setFilterActividad("todos")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterActividad === "todos"
                ? "bg-[#ff7900] text-white"
                : "bg-[#09090b] text-zinc-400 border border-[#27272a]"
            }`}
          >
            Todos ({participantes.length})
          </button>
          <button
            onClick={() => setFilterActividad("con_pronosticos")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterActividad === "con_pronosticos"
                ? "bg-blue-600 text-white"
                : "bg-[#09090b] text-zinc-400 border border-[#27272a]"
            }`}
          >
            🎯 Con Pronósticos Creados
          </button>
          <button
            onClick={() => setFilterActividad("sin_pronosticos")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterActividad === "sin_pronosticos"
                ? "bg-yellow-600 text-white"
                : "bg-[#09090b] text-zinc-400 border border-[#27272a]"
            }`}
          >
            ⚠️ Sin Pronósticos Aún
          </button>
          <button
            onClick={() => setFilterActividad("top_puntos")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterActividad === "top_puntos"
                ? "bg-emerald-600 text-white"
                : "bg-[#09090b] text-zinc-400 border border-[#27272a]"
            }`}
          >
            🔥 Con Puntos Sumados
          </button>
        </div>
      </div>

      {/* LISTADO TABLA DE PARTICIPANTES */}
      <div className="bg-[#121214] border border-[#27272a] rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#27272a] flex justify-between items-center bg-[#09090b]">
          <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
            Directorio de Usuarios ({filteredParticipantes.length} de {participantes.length})
          </h3>
          <span className="text-xs text-zinc-500">
            {emailsFiltrados.length} emails disponibles para copiar
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-4 border-[#ff7900]/20 border-t-[#ff7900] rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs text-zinc-400">
              Cargando lista de participantes...
            </p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-red-400">{error}</div>
        ) : filteredParticipantes.length === 0 ? (
          <div className="py-16 text-center text-xs text-zinc-500">
            No se encontraron usuarios con los filtros aplicados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#09090b] text-zinc-400 text-[11px] font-bold border-b border-[#27272a] uppercase">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Usuario</th>
                  <th className="py-3 px-4">Correo Electrónico</th>
                  <th className="py-3 px-4">Diario / Medio</th>
                  <th className="py-3 px-4 text-center">Puntos</th>
                  <th className="py-3 px-4 text-center">Racha</th>
                  <th className="py-3 px-4 text-center">Pronósticos</th>
                  <th className="py-3 px-4">Registro</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272a]/60 text-xs">
                {filteredParticipantes.map((p, index) => (
                  <tr
                    key={p.id}
                    className="hover:bg-[#18181b] transition-colors group"
                  >
                    {/* Posición */}
                    <td className="py-3.5 px-4 text-center text-zinc-500 font-bold">
                      {index + 1}
                    </td>

                    {/* Usuario */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ff7900] to-orange-700 text-white font-bold flex items-center justify-center text-xs uppercase shadow-md">
                          {p.nombre ? p.nombre.substring(0, 2) : "US"}
                        </div>
                        <div>
                          <span className="font-bold text-white block">
                            {p.nombre}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="py-3.5 px-4 font-mono text-zinc-300">
                      <div className="flex items-center gap-2">
                        <span className="select-all">{p.email}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(p.email);
                            showToast(`📋 Email de ${p.nombre} copiado!`);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-[#ff7900] text-[11px] p-1 rounded bg-[#09090b] border border-[#27272a] transition-all"
                          title="Copiar email"
                        >
                          📋
                        </button>
                      </div>
                    </td>

                    {/* Medio */}
                    <td className="py-3.5 px-4 text-zinc-400">
                      <span className="bg-[#09090b] border border-[#27272a] text-zinc-300 px-2.5 py-1 rounded-lg text-[11px] font-medium">
                        {p.nombre_medio || "DataNE"}
                      </span>
                    </td>

                    {/* Puntos */}
                    <td className="py-3.5 px-4 text-center font-bold">
                      <span className="bg-[#ff7900]/10 text-[#ff7900] border border-[#ff7900]/20 px-2.5 py-1 rounded-lg">
                        {p.puntos_totales} pts
                      </span>
                    </td>

                    {/* Racha */}
                    <td className="py-3.5 px-4 text-center font-bold">
                      {p.racha_actual > 0 ? (
                        <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded text-[11px]">
                          🔥 {p.racha_actual}
                        </span>
                      ) : (
                        <span className="text-zinc-600">0</span>
                      )}
                    </td>

                    {/* Pronósticos */}
                    <td className="py-3.5 px-4 text-center font-bold">
                      <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded text-[11px]">
                        🎯 {p.total_pronosticos}
                      </span>
                    </td>

                    {/* Fecha de Registro */}
                    <td className="py-3.5 px-4 text-zinc-500 text-[11px]">
                      {p.created_at
                        ? new Date(p.created_at).toLocaleDateString("es-AR", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "-"}
                    </td>

                    {/* Acciones */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        {/* Enviar Mail Individual */}
                        <a
                          href={`mailto:${p.email}?subject=${encodeURIComponent(
                            customSubject
                          )}&body=${encodeURIComponent(customBody)}`}
                          className="bg-[#09090b] hover:bg-blue-600 hover:text-white text-zinc-400 border border-[#27272a] p-1.5 rounded-lg transition-all text-xs"
                          title="Enviar correo individual"
                        >
                          ✉️
                        </a>

                        {/* Eliminar Participante */}
                        <button
                          onClick={() => setDeleteCandidate(p)}
                          className="bg-[#09090b] hover:bg-red-600 hover:text-white text-zinc-500 border border-[#27272a] p-1.5 rounded-lg transition-all text-xs"
                          title="Eliminar usuario"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DE CONFIRMACION PARA ELIMINAR */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">
              ¿Eliminar usuario del Prode?
            </h3>
            <p className="text-xs text-zinc-400">
              Estás a punto de borrar a{" "}
              <strong className="text-white">{deleteCandidate.nombre}</strong> (
              {deleteCandidate.email}). Se eliminarán sus puntos y pronósticos.
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setDeleteCandidate(null)}
                className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteParticipant(deleteCandidate.id)}
                className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-xl text-xs"
              >
                Confirmar Borrado
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
