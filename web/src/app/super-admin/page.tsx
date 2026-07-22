"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Cliente = {
  id: string;
  nombre_medio: string;
  email: string;
  estado: string;
  ciudad: string | null;
  clave_periodista: string;
  created_at: string;
};

type Liga = {
  id: string;
  nombre_liga: string;
  es_profesional: boolean;
  api_liga_id?: number | null;
};

type Equipo = {
  id: string;
  nombre_equipo: string;
  logo_url: string;
  liga_id: string;
};

type Partido = {
  id: string;
  equipo_local_id: string;
  equipo_visitante_id: string;
  goles_local: number;
  goles_visitante: number;
  estado_partido: string;
  fecha_hora?: string | null;
  liga_id: string;
  cliente_id: string | null;
  equipo_local?: Equipo;
  equipo_visitante?: Equipo;
  api_partido_id?: number | null;
  minuto_actual?: number | null;
  jornada?: string | null;
};

export default function SuperAdmin() {
  const [activeTab, setActiveTab] = useState<"clientes" | "ligas" | "partidos">("clientes");
  
  // States para datos
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [ligas, setLigas] = useState<Liga[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [suscripciones, setSuscripciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // States para formularios de creación
  const [newCliente, setNewCliente] = useState({ nombre_medio: "", email: "", ciudad: "", clave_periodista: "" });
  const [newLiga, setNewLiga] = useState({ nombre_liga: "", es_profesional: false, api_liga_id: "" });
  const [newEquipo, setNewEquipo] = useState({ nombre_equipo: "", liga_id: "" });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [newPartido, setNewPartido] = useState({
    liga_id: "",
    equipo_local_id: "",
    equipo_visitante_id: "",
    fecha_hora: "",
    cliente_id: "",
    jornada: ""
  });

  const [uploadingLogo, setUploadingLogo] = useState(false);

  // States para sincronización de ligas API
  const [selectedSyncLigaId, setSelectedSyncLigaId] = useState("");
  const [syncSeason, setSyncSeason] = useState(new Date().getFullYear().toString());
  const [syncingLiga, setSyncingLiga] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);

  // States para filtros del fixture en super-admin
  const [filterLigaId, setFilterLigaId] = useState("");
  const [filterClienteId, setFilterClienteId] = useState("");
  const [filterEstado, setFilterEstado] = useState("");

  // States para configuración visual de widgets de clientes
  const [editingConfigClienteId, setEditingConfigClienteId] = useState<string | null>(null);
  const [configColorPrimario, setConfigColorPrimario] = useState("#121214");
  const [configColorSecundario, setConfigColorSecundario] = useState("#ff7900");
  const [configLogoUrl, setConfigLogoUrl] = useState("");
  const [configLogoFile, setConfigLogoFile] = useState<File | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);

  // States para edición de ligas y equipos
  const [editingLiga, setEditingLiga] = useState<Liga | null>(null);
  const [editingEquipo, setEditingEquipo] = useState<Equipo | null>(null);
  const [editingEquipoLogoFile, setEditingEquipoLogoFile] = useState<File | null>(null);
  const [updatingEquipoLogo, setUpdatingEquipoLogo] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      // 1. Clientes
      const { data: dataClientes } = await supabase
        .from("clientes")
        .select("*")
        .order("created_at", { ascending: false });
      setClientes(dataClientes || []);

      // 2. Ligas
      const { data: dataLigas } = await supabase
        .from("ligas")
        .select("id, nombre_liga, es_profesional, api_liga_id")
        .order("nombre_liga");
      setLigas(dataLigas || []);

      // 3. Equipos
      const { data: dataEquipos } = await supabase
        .from("equipos")
        .select("*")
        .order("nombre_equipo");
      setEquipos(dataEquipos || []);

      // 4. Partidos
      const { data: dataPartidos } = await supabase
        .from("partidos")
        .select("*")
        .order("fecha_hora", { ascending: true });
      
      // Mapear equipos a partidos localmente para simplificar la consulta
      const partidosMapeados = (dataPartidos || []).map((p: any) => ({
        ...p,
        equipo_local: dataEquipos?.find(e => e.id === p.equipo_local_id),
        equipo_visitante: dataEquipos?.find(e => e.id === p.equipo_visitante_id)
      }));
      setPartidos(partidosMapeados);

      // 5. Suscripciones a ligas
      const { data: dataSuscripciones } = await supabase
        .from("clientes_ligas")
        .select("*");
      setSuscripciones(dataSuscripciones || []);

    } catch (err) {
      console.error("Error al cargar datos:", err);
    } finally {
      setLoading(false);
    }
  }

  // --- ACCIONES CLIENTES ---
  async function handleCreateCliente(e: React.FormEvent) {
    e.preventDefault();
    if (!newCliente.nombre_medio || !newCliente.email) return;

    const payload = {
      nombre_medio: newCliente.nombre_medio,
      email: newCliente.email,
      ciudad: newCliente.ciudad || null,
      clave_periodista: newCliente.clave_periodista || "123456"
    };

    const { data, error } = await supabase
      .from("clientes")
      .insert([payload])
      .select();

    if (error) {
      alert("Error al crear cliente: " + error.message);
    } else {
      setClientes([data[0], ...clientes]);
      setNewCliente({ nombre_medio: "", email: "", ciudad: "", clave_periodista: "" });
    }
  }

  async function toggleClienteEstado(id: string, estadoActual: string) {
    const nuevoEstado = estadoActual === "activo" ? "inactivo" : "activo";
    const { error } = await supabase
      .from("clientes")
      .update({ estado: nuevoEstado })
      .eq("id", id);

    if (error) {
      alert("Error al actualizar estado: " + error.message);
    } else {
      setClientes(clientes.map(c => c.id === id ? { ...c, estado: nuevoEstado } : c));
    }
  }

  async function handleUpdateCliente(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCliente) return;

    const { error } = await supabase
      .from("clientes")
      .update({
        nombre_medio: editingCliente.nombre_medio,
        email: editingCliente.email,
        ciudad: editingCliente.ciudad || null,
        clave_periodista: editingCliente.clave_periodista
      })
      .eq("id", editingCliente.id);

    if (error) {
      alert("Error al actualizar cliente: " + error.message);
    } else {
      setClientes(clientes.map(c => c.id === editingCliente.id ? editingCliente : c));
      setEditingCliente(null);
    }
  }

  // --- ACCIONES SUSCRIPCIONES (LIGAS A CLIENTES) ---
  async function handleToggleSuscripcion(clienteId: string, ligaId: string, yaSuscrito: boolean) {
    if (yaSuscrito) {
      const { error } = await supabase
        .from("clientes_ligas")
        .delete()
        .eq("cliente_id", clienteId)
        .eq("liga_id", ligaId);

      if (error) {
        alert("Error al remover suscripción: " + error.message);
      } else {
        setSuscripciones(suscripciones.filter(s => !(s.cliente_id === clienteId && s.liga_id === ligaId)));
      }
    } else {
      const { error } = await supabase
        .from("clientes_ligas")
        .insert([{ cliente_id: clienteId, liga_id: ligaId }]);

      if (error) {
        alert("Error al agregar suscripción: " + error.message);
      } else {
        fetchData();
      }
    }
  }

  // --- ACCIONES CONFIGURACIÓN VISUAL ---
  async function loadClienteConfig(clienteId: string) {
    setEditingConfigClienteId(clienteId);
    setConfigColorPrimario("#121214");
    setConfigColorSecundario("#ff7900");
    setConfigLogoUrl("");
    setConfigLogoFile(null);

    const { data, error } = await supabase
      .from("configuracion_widgets")
      .select("*")
      .eq("cliente_id", clienteId)
      .is("liga_id", null)
      .maybeSingle();

    if (error) {
      console.error("Error al cargar configuración:", error);
    } else if (data) {
      setConfigColorPrimario(data.color_primario);
      setConfigColorSecundario(data.color_secundario);
      setConfigLogoUrl(data.logo_medio_url || "");
    }
  }

  async function handleSaveClienteConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!editingConfigClienteId) return;

    setSavingConfig(true);
    let logoUrl = configLogoUrl;

    try {
      if (configLogoFile) {
        const fileExt = configLogoFile.name.split(".").pop();
        const fileName = `sponsors/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("club-logos")
          .upload(fileName, configLogoFile);

        if (uploadError) {
          throw new Error("No se pudo subir el logo. Verifique que exista el bucket 'club-logos'.");
        }

        const { data: urlData } = supabase.storage
          .from("club-logos")
          .getPublicUrl(fileName);

        logoUrl = urlData.publicUrl;
      }

      const { data: existingConfig } = await supabase
        .from("configuracion_widgets")
        .select("id")
        .eq("cliente_id", editingConfigClienteId)
        .is("liga_id", null)
        .maybeSingle();

      const payload = {
        cliente_id: editingConfigClienteId,
        liga_id: null,
        color_primario: configColorPrimario,
        color_secundario: configColorSecundario,
        logo_medio_url: logoUrl || null,
        mostrar_escudos: true
      };

      const { error } = existingConfig
        ? await supabase.from("configuracion_widgets").update(payload).eq("id", existingConfig.id)
        : await supabase.from("configuracion_widgets").insert([payload]);

      if (error) {
        throw error;
      }

      alert("¡Configuración visual del widget guardada!");
      setEditingConfigClienteId(null);
    } catch (err: any) {
      alert("Error al guardar: " + err.message);
    } finally {
      setSavingConfig(false);
    }
  }

  // --- ACCIONES LIGAS ---
  async function handleCreateLiga(e: React.FormEvent) {
    e.preventDefault();
    if (!newLiga.nombre_liga) return;

    const payload = {
      nombre_liga: newLiga.nombre_liga,
      es_profesional: newLiga.es_profesional,
      api_liga_id: newLiga.es_profesional && newLiga.api_liga_id ? parseInt(newLiga.api_liga_id) : null
    };

    const { data, error } = await supabase
      .from("ligas")
      .insert([payload])
      .select();

    if (error) {
      alert("Error al crear liga: " + error.message);
    } else {
      fetchData(); // Recargamos todo para actualizar las relaciones
      setNewLiga({ nombre_liga: "", es_profesional: false, api_liga_id: "" });
    }
  }

  async function handleUpdateLiga(e: React.FormEvent) {
    e.preventDefault();
    if (!editingLiga) return;

    const { error } = await supabase
      .from("ligas")
      .update({
        nombre_liga: editingLiga.nombre_liga,
        es_profesional: editingLiga.es_profesional,
        api_liga_id: editingLiga.es_profesional && editingLiga.api_liga_id ? parseInt(String(editingLiga.api_liga_id)) : null
      })
      .eq("id", editingLiga.id);

    if (error) {
      alert("Error al actualizar liga: " + error.message);
    } else {
      fetchData();
      setEditingLiga(null);
    }
  }

  async function handleSyncLiga() {
    if (!selectedSyncLigaId) return;
    const ligaObj = ligas.find(l => l.id === selectedSyncLigaId);
    if (!ligaObj || !ligaObj.api_liga_id) {
      alert("La liga seleccionada no tiene un ID de API válido.");
      return;
    }

    setSyncingLiga(true);
    setSyncResult(null);

    try {
      const res = await fetch(`/api/sync/import?liga_id=${selectedSyncLigaId}&api_liga_id=${ligaObj.api_liga_id}&season=${syncSeason}`);
      const data = await res.json();

      if (data.success) {
        setSyncResult({
          success: true,
          message: `Éxito: Sincronizados ${data.equipos_sincronizados} equipos y ${data.partidos_sincronizados} partidos para la temporada ${syncSeason}.`
        });
        fetchData(); // Recargar para listar equipos y partidos nuevos
      } else {
        setSyncResult({
          success: false,
          message: `Error: ${data.error || "Ocurrió un error inesperado."}`
        });
      }
    } catch (err: any) {
      setSyncResult({
        success: false,
        message: `Error de red: ${err.message}`
      });
    } finally {
      setSyncingLiga(false);
    }
  }

  // --- ACCIONES EQUIPOS ---
  async function handleCreateEquipo(e: React.FormEvent) {
    e.preventDefault();
    if (!newEquipo.nombre_equipo || !newEquipo.liga_id) return;

    setUploadingLogo(true);
    let logoUrl = "";

    try {
      if (logoFile) {
        const fileExt = logoFile.name.split(".").pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `logos/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("club-logos")
          .upload(filePath, logoFile);

        if (uploadError) {
          throw new Error("No se pudo subir la imagen. ¿Creaste el bucket 'club-logos' como público en Supabase?");
        }

        const { data: urlData } = supabase.storage
          .from("club-logos")
          .getPublicUrl(filePath);

        logoUrl = urlData.publicUrl;
      }

      const { data, error } = await supabase
        .from("equipos")
        .insert([{
          nombre_equipo: newEquipo.nombre_equipo,
          liga_id: newEquipo.liga_id,
          logo_url: logoUrl || "https://placehold.co/100x100/121214/fff?text=FC",
          es_profesional: ligas.find(l => l.id === newEquipo.liga_id)?.es_profesional || false
        }])
        .select();

      if (error) {
        alert("Error al crear equipo: " + error.message);
      } else {
        setEquipos([...equipos, data[0]]);
        setNewEquipo({ nombre_equipo: "", liga_id: "" });
        setLogoFile(null);
        const fileInput = document.getElementById("logo-file") as HTMLInputElement;
        if (fileInput) fileInput.value = "";
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleUpdateEquipo(e: React.FormEvent) {
    e.preventDefault();
    if (!editingEquipo) return;

    setUpdatingEquipoLogo(true);
    let logoUrl = editingEquipo.logo_url;

    try {
      if (editingEquipoLogoFile) {
        const fileExt = editingEquipoLogoFile.name.split(".").pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `logos/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("club-logos")
          .upload(filePath, editingEquipoLogoFile);

        if (uploadError) {
          throw new Error("No se pudo subir el nuevo escudo a Supabase Storage.");
        }

        const { data: urlData } = supabase.storage
          .from("club-logos")
          .getPublicUrl(filePath);

        logoUrl = urlData.publicUrl;
      }

      const { error } = await supabase
        .from("equipos")
        .update({
          nombre_equipo: editingEquipo.nombre_equipo,
          liga_id: editingEquipo.liga_id,
          logo_url: logoUrl,
          es_profesional: ligas.find(l => l.id === editingEquipo.liga_id)?.es_profesional || false
        })
        .eq("id", editingEquipo.id);

      if (error) {
        throw error;
      }

      setEquipos(equipos.map(eq => eq.id === editingEquipo.id ? { ...editingEquipo, logo_url: logoUrl } : eq));
      setEditingEquipo(null);
      setEditingEquipoLogoFile(null);
      
      const fileInput = document.getElementById("edit-logo-file") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    } catch (err: any) {
      alert("Error al actualizar equipo: " + err.message);
    } finally {
      setUpdatingEquipoLogo(false);
    }
  }

  const formatForDatetimeLocal = (isoStr?: string | null) => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // --- ACCIONES PARTIDOS ---
  async function handleCreatePartido(e: React.FormEvent) {
    e.preventDefault();
    const { liga_id, equipo_local_id, equipo_visitante_id, fecha_hora, cliente_id, jornada } = newPartido;
    if (!liga_id || !equipo_local_id || !equipo_visitante_id) return;

    const { data, error } = await supabase
      .from("partidos")
      .insert([{
        liga_id,
        equipo_local_id,
        equipo_visitante_id,
        fecha_hora: fecha_hora ? new Date(fecha_hora).toISOString() : null,
        estado_partido: "programado",
        cliente_id: cliente_id === "" ? null : cliente_id,
        jornada: jornada === "" ? null : jornada
      }])
      .select();

    if (error) {
      alert("Error al programar partido: " + error.message);
    } else {
      fetchData();
      setNewPartido({ liga_id: "", equipo_local_id: "", equipo_visitante_id: "", fecha_hora: "", cliente_id: "", jornada: "" });
    }
  }

  async function handleMoveMatchToToday(partidoId: string) {
    const todayIso = new Date().toISOString();
    const { error } = await supabase
      .from("partidos")
      .update({ fecha_hora: todayIso })
      .eq("id", partidoId);

    if (error) {
      alert("Error al mover el partido a hoy: " + error.message);
    } else {
      alert("¡Partido movido al día de hoy! Ya debería aparecer en tu widget.");
      fetchData();
    }
  }

  async function handleUpdateJornada(partidoId: string, jornadaVal: string) {
    const { error } = await supabase
      .from("partidos")
      .update({ jornada: jornadaVal === "" ? null : jornadaVal })
      .eq("id", partidoId);

    if (error) {
      console.error("Error al actualizar jornada:", error);
    } else {
      setPartidos(partidos.map(p => p.id === partidoId ? { ...p, jornada: jornadaVal === "" ? null : jornadaVal } : p));
    }
  }

  async function handleUpdateFechaHora(partidoId: string, fechaHoraVal: string) {
    const isoVal = fechaHoraVal ? new Date(fechaHoraVal).toISOString() : null;
    const { error } = await supabase
      .from("partidos")
      .update({ fecha_hora: isoVal })
      .eq("id", partidoId);

    if (error) {
      console.error("Error al actualizar fecha y hora:", error);
    } else {
      setPartidos(partidos.map(p => p.id === partidoId ? { ...p, fecha_hora: isoVal } : p));
    }
  }

  async function handleSyncMatchFromAPI(apiPartidoId: number) {
    try {
      const res = await fetch(`/api/sync/match?api_partido_id=${apiPartidoId}`);
      const data = await res.json();
      if (data.success) {
        alert(`¡Sincronización exitosa! Marcador API: ${data.partido.goles_local} - ${data.partido.goles_visitante} (${data.partido.estado_partido})`);
        fetchData();
      } else {
        alert("Error al sincronizar partido: " + (data.error || "Error desconocido"));
      }
    } catch (err: any) {
      alert("Error de red al sincronizar: " + err.message);
    }
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] font-sans pb-16">
      {/* Sub-Header */}
      <header className="border-b border-[#27272a] bg-[#121214] py-6 px-8 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wide">
              MUOVE <span className="text-[#ff7900]">| SUPER-ADMIN</span>
            </h1>
            <p className="text-xs text-zinc-400 mt-1">Panel de control de clientes, ligas y fixtures</p>
          </div>
          <Link href="/" className="text-xs text-zinc-400 hover:text-[#ff7900] border border-zinc-800 hover:border-[#ff7900]/30 px-4 py-2 rounded-xl bg-[#09090b] transition-all">
            ← Volver al Inicio
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-8">
        {/* Tabs */}
        <div className="flex border-b border-[#27272a] mb-8 gap-4">
          <button
            onClick={() => setActiveTab("clientes")}
            className={`py-3 px-4 text-sm font-bold border-b-2 transition-all ${
              activeTab === "clientes"
                ? "border-[#ff7900] text-[#ff7900]"
                : "border-transparent text-zinc-400 hover:text-white"
            }`}
          >
            Diarios (Clientes)
          </button>
          <button
            onClick={() => setActiveTab("ligas")}
            className={`py-3 px-4 text-sm font-bold border-b-2 transition-all ${
              activeTab === "ligas"
                ? "border-[#ff7900] text-[#ff7900]"
                : "border-transparent text-zinc-400 hover:text-white"
            }`}
          >
            Ligas y Equipos
          </button>
          <button
            onClick={() => setActiveTab("partidos")}
            className={`py-3 px-4 text-sm font-bold border-b-2 transition-all ${
              activeTab === "partidos"
                ? "border-[#ff7900] text-[#ff7900]"
                : "border-transparent text-zinc-400 hover:text-white"
            }`}
          >
            Fixture (Partidos)
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-[#ff7900]/20 border-t-[#ff7900] rounded-full animate-spin mb-4"></div>
            <p className="text-zinc-500 text-sm">Cargando datos del servidor...</p>
          </div>
        ) : (
          <div>
            {/* --- SECCIÓN CLIENTES --- */}
            {activeTab === "clientes" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Formulario */}
                <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 h-fit">
                  <h2 className="text-lg font-bold text-white mb-4">Registrar Nuevo Medio</h2>
                  <form onSubmit={handleCreateCliente} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-2">Nombre del Medio</label>
                      <input
                        type="text"
                        placeholder="Ej. Diario TSN Necochea"
                        value={newCliente.nombre_medio}
                        onChange={e => setNewCliente({ ...newCliente, nombre_medio: e.target.value })}
                        className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff7900]/50 transition-colors"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-2">Email de Contacto</label>
                      <input
                        type="email"
                        placeholder="Ej. contacto@tsnnecochea.com"
                        value={newCliente.email}
                        onChange={e => setNewCliente({ ...newCliente, email: e.target.value })}
                        className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff7900]/50 transition-colors"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-2">Ciudad</label>
                      <input
                        type="text"
                        placeholder="Ej. Pehuajó"
                        value={newCliente.ciudad}
                        onChange={e => setNewCliente({ ...newCliente, ciudad: e.target.value })}
                        className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff7900]/50 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-2">Clave / PIN Periodista (Acceso CMS)</label>
                      <input
                        type="text"
                        placeholder="Ej. 123456"
                        value={newCliente.clave_periodista}
                        onChange={e => setNewCliente({ ...newCliente, clave_periodista: e.target.value })}
                        className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff7900]/50 transition-colors"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-[#ff7900] hover:bg-[#e06b00] text-white font-bold py-3 rounded-xl transition-colors text-sm"
                    >
                      Dar de Alta Cliente
                    </button>
                  </form>
                </div>

                <div className="lg:col-span-2 space-y-4">
                  <h2 className="text-lg font-bold text-white mb-4">Medios Registrados ({clientes.length})</h2>
                  {clientes.length === 0 ? (
                    <p className="text-zinc-500 text-sm">No hay clientes cargados en el sistema.</p>
                  ) : (
                    clientes.map(cliente => (
                      <div key={cliente.id} className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 flex flex-col gap-6 hover:border-zinc-800 transition-colors">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div>
                            <div className="flex items-center gap-3">
                              <h3 className="font-bold text-white text-lg">{cliente.nombre_medio}</h3>
                              <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                                cliente.estado === "activo"
                                  ? "bg-green-500/10 text-green-400 border-green-500/20"
                                  : "bg-red-500/10 text-red-500 border-red-500/20"
                              }`}>
                                {cliente.estado === "activo" ? "Activo" : "Inactivo"}
                              </span>
                            </div>
                            <p className="text-sm text-zinc-400 mt-1">{cliente.email}</p>
                            <div className="flex flex-wrap gap-2 text-xs mt-2 text-zinc-400">
                              <span>Ciudad: <strong className="text-white">{cliente.ciudad || "No especificada"}</strong></span>
                              <span className="text-zinc-600">•</span>
                              <span>PIN Acceso: <strong className="text-[#ff7900]">{cliente.clave_periodista}</strong></span>
                            </div>
                            <div className="mt-3 bg-[#09090b] border border-[#27272a] p-3 rounded-xl">
                              <span className="text-[10px] text-zinc-500 block font-semibold mb-1">ID CLIENTE (WIDGET CODE):</span>
                              <code className="text-xs text-[#ff7900] select-all break-all">{cliente.id}</code>
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                            <button
                              onClick={() => setEditingCliente(cliente)}
                              className="font-bold py-2.5 px-4 rounded-xl text-sm border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
                            >
                              Editar Datos
                            </button>
                            <button
                              onClick={() => loadClienteConfig(cliente.id)}
                              className="font-bold py-2.5 px-4 rounded-xl text-sm border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
                            >
                              Configurar Estilo / Sponsor
                            </button>
                            <button
                              onClick={() => toggleClienteEstado(cliente.id, cliente.estado)}
                              className={`font-bold py-2.5 px-4 rounded-xl text-sm transition-colors ${
                                cliente.estado === "activo"
                                  ? "bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30"
                                  : "bg-[#ff7900]/10 hover:bg-[#ff7900]/20 text-[#ff7900] border border-[#ff7900]/30"
                              }`}
                            >
                              {cliente.estado === "activo" ? "Dar de Baja" : "Reactivar"}
                            </button>
                          </div>
                        </div>

                        {/* Formulario de Edición de Datos cuando se está editando */}
                        {editingCliente && editingCliente.id === cliente.id && (
                          <form onSubmit={handleUpdateCliente} className="bg-[#09090b] border border-[#27272a] rounded-xl p-4 mt-2 space-y-4">
                            <h4 className="text-sm font-bold text-[#ff7900]">Editar Datos de {cliente.nombre_medio}</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-semibold text-zinc-400 mb-2">Nombre del Medio</label>
                                <input
                                  type="text"
                                  value={editingCliente.nombre_medio}
                                  onChange={e => setEditingCliente({ ...editingCliente, nombre_medio: e.target.value })}
                                  className="w-full bg-[#121214] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff7900]/50"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-zinc-400 mb-2">Email de Contacto</label>
                                <input
                                  type="email"
                                  value={editingCliente.email}
                                  onChange={e => setEditingCliente({ ...editingCliente, email: e.target.value })}
                                  className="w-full bg-[#121214] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff7900]/50"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-zinc-400 mb-2">Ciudad</label>
                                <input
                                  type="text"
                                  value={editingCliente.ciudad || ""}
                                  onChange={e => setEditingCliente({ ...editingCliente, ciudad: e.target.value })}
                                  className="w-full bg-[#121214] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff7900]/50"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-zinc-400 mb-2">Clave / PIN Acceso</label>
                                <input
                                  type="text"
                                  value={editingCliente.clave_periodista}
                                  onChange={e => setEditingCliente({ ...editingCliente, clave_periodista: e.target.value })}
                                  className="w-full bg-[#121214] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff7900]/50"
                                  required
                                />
                              </div>
                            </div>
                            <div className="flex gap-3 justify-end pt-2">
                              <button
                                type="button"
                                onClick={() => setEditingCliente(null)}
                                className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors"
                              >
                                Cancelar
                              </button>
                              <button
                                type="submit"
                                className="bg-[#ff7900] hover:bg-[#e06b00] text-white font-bold py-2 px-5 rounded-xl text-xs transition-colors"
                              >
                                Guardar Cambios
                              </button>
                            </div>
                          </form>
                        )}

                        {/* Gestor de Suscripciones (Ligas Asignadas) */}
                        <div className="border-t border-zinc-800 pt-4 mt-2">
                          <h4 className="text-xs font-bold text-zinc-300 mb-3">Ligas Asignadas / Suscripciones</h4>
                          {ligas.length === 0 ? (
                            <p className="text-xs text-zinc-600">No hay ligas cargadas en la plataforma.</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {ligas.map(liga => {
                                const yaSuscrito = suscripciones.some(s => s.cliente_id === cliente.id && s.liga_id === liga.id);
                                return (
                                  <button
                                    key={liga.id}
                                    onClick={() => handleToggleSuscripcion(cliente.id, liga.id, yaSuscrito)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                      yaSuscrito
                                        ? "bg-[#ff7900]/10 text-[#ff7900] border border-[#ff7900]/30 hover:bg-[#ff7900]/20"
                                        : "bg-[#09090b] text-zinc-400 border border-[#27272a] hover:text-white"
                                    }`}
                                  >
                                    {liga.nombre_liga} {yaSuscrito ? "✓" : "+"}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Formulario de Configuración Visual cuando se edita */}
                        {editingConfigClienteId === cliente.id && (
                          <form onSubmit={handleSaveClienteConfig} className="bg-[#09090b] border border-[#27272a] rounded-xl p-4 mt-2 space-y-4">
                            <h4 className="text-sm font-bold text-[#ff7900]">Personalizar Widget para {cliente.nombre_medio}</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-semibold text-zinc-400 mb-2">Color de Fondo Sponsor (Hex)</label>
                                <div className="flex gap-2">
                                  <input
                                    type="color"
                                    value={configColorPrimario}
                                    onChange={e => setConfigColorPrimario(e.target.value)}
                                    className="w-10 h-10 border-0 bg-transparent cursor-pointer rounded"
                                  />
                                  <input
                                    type="text"
                                    value={configColorPrimario}
                                    onChange={e => setConfigColorPrimario(e.target.value)}
                                    className="w-full bg-[#121214] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white uppercase focus:outline-none"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-zinc-400 mb-2">Color de Acento Detalles (Hex)</label>
                                <div className="flex gap-2">
                                  <input
                                    type="color"
                                    value={configColorSecundario}
                                    onChange={e => setConfigColorSecundario(e.target.value)}
                                    className="w-10 h-10 border-0 bg-transparent cursor-pointer rounded"
                                  />
                                  <input
                                    type="text"
                                    value={configColorSecundario}
                                    onChange={e => setConfigColorSecundario(e.target.value)}
                                    className="w-full bg-[#121214] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white uppercase focus:outline-none"
                                  />
                                </div>
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-zinc-400 mb-2">Logo del Diario o Sponsor</label>
                              <div className="flex flex-col sm:flex-row gap-4 items-center">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={e => setConfigLogoFile(e.target.files ? e.target.files[0] : null)}
                                  className="w-full text-zinc-400 text-xs border border-dashed border-[#27272a] rounded-xl p-3 bg-[#121214]"
                                />
                                {configLogoUrl && (
                                  <div className="flex flex-col items-center gap-1">
                                    <span className="text-[9px] text-zinc-500 font-bold">ACTUAL:</span>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={configLogoUrl} alt="" className="h-10 object-contain bg-[#121214] p-1 border border-zinc-800 rounded" />
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex gap-3 justify-end pt-2">
                              <button
                                type="button"
                                onClick={() => setEditingConfigClienteId(null)}
                                className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors"
                              >
                                Cancelar
                              </button>
                              <button
                                type="submit"
                                disabled={savingConfig}
                                className="bg-[#ff7900] hover:bg-[#e06b00] text-white font-bold py-2 px-5 rounded-xl text-xs transition-colors"
                              >
                                {savingConfig ? "Guardando..." : "Guardar Estilos"}
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* --- SECCIÓN LIGAS Y EQUIPOS --- */}
            {activeTab === "ligas" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Crear Liga */}
                <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-white mb-4 font-sans">Crear Nueva Liga / Torneo</h2>
                    <form onSubmit={handleCreateLiga} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-400 mb-2">Nombre del Torneo</label>
                        <input
                          type="text"
                          placeholder="Ej. Liga Necochea de Fútbol"
                          value={newLiga.nombre_liga}
                          onChange={e => setNewLiga({ ...newLiga, nombre_liga: e.target.value })}
                          className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff7900]/50 transition-colors"
                          required
                        />
                      </div>
                      <div className="flex gap-4 items-center">
                        <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-zinc-300">
                          <input
                            type="checkbox"
                            checked={newLiga.es_profesional}
                            onChange={e => setNewLiga({ ...newLiga, es_profesional: e.target.checked })}
                            className="w-4 h-4 rounded accent-[#ff7900]"
                          />
                          ¿Es Liga Profesional (Vía API)?
                        </label>
                      </div>
                      {newLiga.es_profesional && (
                        <div>
                          <label className="block text-xs font-semibold text-zinc-400 mb-2">ID de Liga en API-Football</label>
                          <input
                            type="number"
                            placeholder="Ej. 128"
                            value={newLiga.api_liga_id}
                            onChange={e => setNewLiga({ ...newLiga, api_liga_id: e.target.value })}
                            className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff7900]/50 transition-colors"
                            required
                          />
                        </div>
                      )}
                      <button
                        type="submit"
                        className="w-full bg-[#ff7900] hover:bg-[#e06b00] text-white font-bold py-3 rounded-xl transition-colors text-sm"
                      >
                        Crear Liga
                      </button>
                    </form>
                  </div>

                  <div className="border-t border-[#27272a] pt-6">
                    <h2 className="text-lg font-bold text-white mb-4">Ligas Existentes ({ligas.length})</h2>
                    <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                      {ligas.map(liga => (
                        <div key={liga.id} className="p-3 bg-[#09090b] border border-[#27272a] rounded-xl flex flex-col gap-2 text-sm">
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="font-bold text-white">{liga.nombre_liga}</span>
                              <span className="text-[10px] text-zinc-500 block">
                                {liga.es_profesional ? "Profesional" : "Manual (Global)"}
                              </span>
                            </div>
                            <button
                              onClick={() => setEditingLiga(liga)}
                              className="text-xs text-[#ff7900] hover:text-[#e06b00] font-semibold border border-[#ff7900]/20 bg-[#ff7900]/5 px-2.5 py-1 rounded-lg"
                            >
                              Editar
                            </button>
                          </div>
                          
                          {editingLiga && editingLiga.id === liga.id && (
                            <form onSubmit={handleUpdateLiga} className="border-t border-zinc-800 pt-2.5 mt-1 space-y-3">
                              <div>
                                <label className="block text-[10px] text-zinc-400 mb-1">Nombre de la Liga</label>
                                <input
                                  type="text"
                                  value={editingLiga.nombre_liga}
                                  onChange={e => setEditingLiga({ ...editingLiga, nombre_liga: e.target.value })}
                                  className="w-full bg-[#121214] border border-[#27272a] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id={`edit-prof-${liga.id}`}
                                  checked={editingLiga.es_profesional}
                                  onChange={e => setEditingLiga({ ...editingLiga, es_profesional: e.target.checked })}
                                  className="w-3.5 h-3.5 rounded accent-[#ff7900]"
                                />
                                <label htmlFor={`edit-prof-${liga.id}`} className="text-xs text-zinc-300 cursor-pointer select-none">
                                  ¿Es Liga Profesional?
                                </label>
                              </div>
                              {editingLiga.es_profesional && (
                                <div>
                                  <label className="block text-[10px] text-zinc-400 mb-1">ID de Liga en API-Football</label>
                                  <input
                                    type="number"
                                    value={editingLiga.api_liga_id || ""}
                                    onChange={e => setEditingLiga({ ...editingLiga, api_liga_id: e.target.value ? parseInt(e.target.value) : null })}
                                    className="w-full bg-[#121214] border border-[#27272a] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                                    required
                                  />
                                </div>
                              )}
                              <div className="flex justify-end gap-2 text-xs">
                                <button
                                  type="button"
                                  onClick={() => setEditingLiga(null)}
                                  className="text-zinc-400 hover:text-white px-2 py-1"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="submit"
                                  className="bg-[#ff7900] text-white px-3 py-1 rounded-lg font-bold"
                                >
                                  Guardar
                                </button>
                              </div>
                            </form>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sincronizador de Ligas Profesionales (API) */}
                <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 space-y-6 mt-6">
                  <div>
                    <h2 className="text-lg font-bold text-white mb-4">Sincronizar Liga Profesional (API)</h2>
                    <p className="text-xs text-zinc-400 mb-4">
                      Descarga y sincroniza automáticamente todos los equipos y partidos completos desde API-Football para guardarlos en Supabase.
                    </p>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-400 mb-2">Seleccionar Liga Profesional</label>
                        <select
                          value={selectedSyncLigaId}
                          onChange={e => setSelectedSyncLigaId(e.target.value)}
                          className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff7900]/50 transition-colors"
                        >
                          <option value="">-- Seleccionar Liga --</option>
                          {ligas.filter(l => l.es_profesional && l.api_liga_id).map(l => (
                            <option key={l.id} value={l.id}>
                              {l.nombre_liga} (API ID: {l.api_liga_id})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-400 mb-2">Temporada (Año)</label>
                        <input
                          type="number"
                          placeholder="Ej. 2026"
                          value={syncSeason}
                          onChange={e => setSyncSeason(e.target.value)}
                          className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff7900]/50 transition-colors"
                        />
                      </div>
                      <button
                        onClick={handleSyncLiga}
                        disabled={syncingLiga || !selectedSyncLigaId}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors text-sm"
                      >
                        {syncingLiga ? "Sincronizando..." : "Iniciar Importación Completa"}
                      </button>
                      {syncResult && (
                        <div className={`p-4 rounded-xl text-xs font-semibold border ${
                          syncResult.success 
                            ? "bg-green-500/10 text-green-400 border-green-500/20" 
                            : "bg-red-500/10 text-red-400 border-red-500/20"
                        }`}>
                          {syncResult.message}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Crear Equipo */}
                <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-white mb-4">Agregar Equipo a una Liga</h2>
                    <form onSubmit={handleCreateEquipo} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-400 mb-2">Seleccionar Liga</label>
                        <select
                          value={newEquipo.liga_id}
                          onChange={e => setNewEquipo({ ...newEquipo, liga_id: e.target.value })}
                          className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#00e676]/50 transition-colors"
                          required
                        >
                          <option value="">-- Seleccionar Liga --</option>
                          {ligas.map(l => (
                            <option key={l.id} value={l.id}>
                              {l.nombre_liga} ({l.es_profesional ? "Prof" : "Manual"})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-400 mb-2">Nombre del Equipo</label>
                        <input
                          type="text"
                          placeholder="Ej. Club All Boys Necochea"
                          value={newEquipo.nombre_equipo}
                          onChange={e => setNewEquipo({ ...newEquipo, nombre_equipo: e.target.value })}
                          className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff7900]/50 transition-colors"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-400 mb-2">Logo/Escudo del Club</label>
                        <input
                          id="logo-file"
                          type="file"
                          accept="image/*"
                          onChange={e => setLogoFile(e.target.files ? e.target.files[0] : null)}
                          className="w-full text-zinc-400 text-xs border border-dashed border-[#27272a] rounded-xl p-3 cursor-pointer bg-[#09090b]"
                        />
                        <p className="text-[10px] text-zinc-500 mt-1">Recomendado .png transparente con fondo recortado.</p>
                      </div>
                      <button
                        type="submit"
                        disabled={uploadingLogo}
                        className="w-full bg-[#ff7900] hover:bg-[#e06b00] text-white font-bold py-3 rounded-xl transition-colors text-sm disabled:opacity-50"
                      >
                        {uploadingLogo ? "Subiendo Logo..." : "Agregar Equipo"}
                      </button>
                    </form>
                  </div>

                    <div className="max-h-80 overflow-y-auto space-y-2 pr-2">
                      {equipos.map(equipo => (
                        <div key={equipo.id} className="p-3 bg-[#09090b] border border-[#27272a] rounded-xl flex flex-col gap-3 text-xs">
                          <div className="flex justify-between items-center gap-3">
                            <div className="flex items-center gap-3">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={equipo.logo_url} alt={equipo.nombre_equipo} className="w-8 h-8 object-contain rounded" />
                              <div>
                                <span className="font-bold text-white block">{equipo.nombre_equipo}</span>
                                <span className="text-[9px] text-zinc-500 block">
                                  Liga: {ligas.find(l => l.id === equipo.liga_id)?.nombre_liga || "Desconocida"}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => setEditingEquipo(equipo)}
                              className="text-xs text-[#ff7900] hover:text-[#e06b00] font-semibold border border-[#ff7900]/20 bg-[#ff7900]/5 px-2.5 py-1 rounded-lg"
                            >
                              Editar
                            </button>
                          </div>

                          {editingEquipo && editingEquipo.id === equipo.id && (
                            <form onSubmit={handleUpdateEquipo} className="border-t border-zinc-800 pt-3 space-y-3">
                              <div>
                                <label className="block text-[10px] text-zinc-400 mb-1">Nombre del Equipo</label>
                                <input
                                  type="text"
                                  value={editingEquipo.nombre_equipo}
                                  onChange={e => setEditingEquipo({ ...editingEquipo, nombre_equipo: e.target.value })}
                                  className="w-full bg-[#121214] border border-[#27272a] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-zinc-400 mb-1">Seleccionar Liga</label>
                                <select
                                  value={editingEquipo.liga_id}
                                  onChange={e => setEditingEquipo({ ...editingEquipo, liga_id: e.target.value })}
                                  className="w-full bg-[#121214] border border-[#27272a] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                                  required
                                >
                                  {ligas.map(l => (
                                    <option key={l.id} value={l.id}>{l.nombre_liga}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] text-zinc-400 mb-1">Nuevo Escudo (Opcional)</label>
                                <input
                                  id="edit-logo-file"
                                  type="file"
                                  accept="image/*"
                                  onChange={e => setEditingEquipoLogoFile(e.target.files ? e.target.files[0] : null)}
                                  className="w-full text-zinc-400 text-[10px] border border-dashed border-[#27272a] rounded-lg p-2 bg-[#121214]"
                                />
                              </div>
                              <div className="flex justify-end gap-2 text-[10px]">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingEquipo(null);
                                    setEditingEquipoLogoFile(null);
                                  }}
                                  className="text-zinc-400 hover:text-white px-2 py-1"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="submit"
                                  disabled={updatingEquipoLogo}
                                  className="bg-[#ff7900] text-white px-3 py-1.5 rounded-lg font-bold disabled:opacity-50"
                                >
                                  {updatingEquipoLogo ? "Subiendo..." : "Guardar Cambios"}
                                </button>
                              </div>
                            </form>
                          )}
                        </div>
                      ))}
                    </div>
                </div>
              </div>
            )}

            {/* --- SECCIÓN PARTIDOS (FIXTURE) --- */}
            {activeTab === "partidos" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Programar Partido */}
                <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 h-fit">
                  <h2 className="text-lg font-bold text-white mb-4">Programar Encuentro</h2>
                  <form onSubmit={handleCreatePartido} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-2">Seleccionar Liga</label>
                      <select
                        value={newPartido.liga_id}
                        onChange={e => setNewPartido({ ...newPartido, liga_id: e.target.value, equipo_local_id: "", equipo_visitante_id: "" })}
                        className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff7900]/50 transition-colors"
                        required
                      >
                        <option value="">-- Seleccionar Liga --</option>
                        {ligas.filter(l => !l.es_profesional).map(l => (
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
                            className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff7900]/50 transition-colors"
                            required
                          >
                            <option value="">-- Seleccionar Local --</option>
                            {equipos.filter(e => e.liga_id === newPartido.liga_id).map(e => (
                              <option key={e.id} value={e.id}>{e.nombre_equipo}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-zinc-400 mb-2">Equipo Visitante</label>
                          <select
                            value={newPartido.equipo_visitante_id}
                            onChange={e => setNewPartido({ ...newPartido, equipo_visitante_id: e.target.value })}
                            className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff7900]/50 transition-colors"
                            required
                          >
                            <option value="">-- Seleccionar Visitante --</option>
                            {equipos.filter(e => e.liga_id === newPartido.liga_id && e.id !== newPartido.equipo_local_id).map(e => (
                              <option key={e.id} value={e.id}>{e.nombre_equipo}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-2">Asignar a Medio (Diario)</label>
                      <select
                        value={newPartido.cliente_id}
                        onChange={e => setNewPartido({ ...newPartido, cliente_id: e.target.value })}
                        className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff7900]/50 transition-colors"
                      >
                        <option value="">-- Partido Global / Profesional --</option>
                        {clientes.map(c => (
                          <option key={c.id} value={c.id}>{c.nombre_medio}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-2">Jornada / Fecha (ej. Fecha 10, Semifinal)</label>
                      <input
                        type="text"
                        placeholder="Ej. Fecha 10"
                        value={newPartido.jornada || ""}
                        onChange={e => setNewPartido({ ...newPartido, jornada: e.target.value })}
                        className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff7900]/50 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-2">Fecha y Hora (Opcional - A confirmar)</label>
                      <input
                        type="datetime-local"
                        value={newPartido.fecha_hora}
                        onChange={e => setNewPartido({ ...newPartido, fecha_hora: e.target.value })}
                        className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff7900]/50 transition-colors"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-[#ff7900] hover:bg-[#e06b00] text-white font-bold py-3 rounded-xl transition-colors text-sm"
                    >
                      Programar Partido
                    </button>
                  </form>
                </div>

                {/* Listado Partidos */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Barra de Filtros */}
                  <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-5 mb-6 flex flex-wrap gap-4 items-end">
                    <div className="flex-grow min-w-[180px]">
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">Filtrar por Liga</label>
                      <select
                        value={filterLigaId}
                        onChange={e => setFilterLigaId(e.target.value)}
                        className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff7900]/50 transition-colors"
                      >
                        <option value="">-- Todas las Ligas --</option>
                        {ligas.map(l => (
                          <option key={l.id} value={l.id}>{l.nombre_liga} {l.es_profesional ? "(API)" : ""}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex-grow min-w-[180px]">
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">Filtrar por Medio / Diario</label>
                      <select
                        value={filterClienteId}
                        onChange={e => setFilterClienteId(e.target.value)}
                        className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff7900]/50 transition-colors"
                      >
                        <option value="">-- Todos los Medios / Globales --</option>
                        <option value="global">Partidos Globales (Profesionales)</option>
                        {clientes.map(c => (
                          <option key={c.id} value={c.id}>{c.nombre_medio}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex-grow min-w-[140px]">
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">Filtrar por Estado</label>
                      <select
                        value={filterEstado}
                        onChange={e => setFilterEstado(e.target.value)}
                        className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff7900]/50 transition-colors"
                      >
                        <option value="">-- Todos los Estados --</option>
                        <option value="programado">Programados</option>
                        <option value="en_vivo">En Vivo</option>
                        <option value="finalizado">Finalizados</option>
                        <option value="demorado">Demorados</option>
                        <option value="suspendido">Suspendidos</option>
                      </select>
                    </div>

                    {(filterLigaId || filterClienteId || filterEstado) && (
                      <button
                        onClick={() => {
                          setFilterLigaId("");
                          setFilterClienteId("");
                          setFilterEstado("");
                        }}
                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors flex-shrink-0"
                      >
                        Limpiar Filtros
                      </button>
                    )}
                  </div>

                  {(() => {
                    const partidosFiltrados = partidos.filter(partido => {
                      if (filterLigaId && partido.liga_id !== filterLigaId) return false;
                      
                      if (filterClienteId) {
                        if (filterClienteId === "global" && partido.cliente_id !== null) return false;
                        if (filterClienteId !== "global" && partido.cliente_id !== filterClienteId) return false;
                      }
                      
                      if (filterEstado && partido.estado_partido !== filterEstado) return false;
                      
                      return true;
                    });

                    return (
                      <>
                        <h2 className="text-lg font-bold text-white mb-4">
                          Fixture Cargado ({partidosFiltrados.length} {partidosFiltrados.length !== partidos.length ? `filtrados de ${partidos.length}` : ""})
                        </h2>
                        {partidosFiltrados.length === 0 ? (
                          <p className="text-zinc-500 text-sm">No hay encuentros programados que coincidan con los filtros.</p>
                        ) : (
                          partidosFiltrados.map(partido => (
                            <div key={partido.id} className="bg-[#121214] border border-[#27272a] rounded-2xl p-5 hover:border-zinc-800 transition-colors">
                              <div className="flex justify-between items-center mb-3">
                                <span className="text-xs font-bold text-zinc-500 flex items-center gap-1.5">
                                  {ligas.find(l => l.id === partido.liga_id)?.nombre_liga}
                                  {partido.jornada && <span className="bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded text-[10px] font-semibold">{partido.jornada}</span>}
                                </span>
                                <span className="text-xs text-[#ff7900] font-bold">
                                  {partido.fecha_hora && !isNaN(new Date(partido.fecha_hora).getTime())
                                    ? `${new Date(partido.fecha_hora).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} HS`
                                    : "A CONFIRMAR"}
                                </span>
                              </div>
                              <div className="flex items-center justify-between bg-[#09090b] p-4 rounded-xl">
                                <div className="flex items-center gap-3 w-5/12">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={partido.equipo_local?.logo_url} alt="" className="w-8 h-8 object-contain" />
                                  <span className="text-sm font-bold text-white truncate">{partido.equipo_local?.nombre_equipo}</span>
                                </div>
                                
                                <div className="flex items-center gap-2 text-lg font-black text-white bg-[#121214] px-4 py-1.5 rounded-lg border border-[#27272a]">
                                  <span>{partido.goles_local}</span>
                                  <span className="text-zinc-600 font-normal text-sm px-1">VS</span>
                                  <span>{partido.goles_visitante}</span>
                                </div>

                                <div className="flex items-center gap-3 w-5/12 justify-end">
                                  <span className="text-sm font-bold text-white truncate">{partido.equipo_visitante?.nombre_equipo}</span>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={partido.equipo_visitante?.logo_url} alt="" className="w-8 h-8 object-contain" />
                                </div>
                              </div>
                              <div className="flex justify-between items-center mt-3 text-xs text-zinc-500">
                                <span className="flex items-center gap-1.5">
                                  Estado: 
                                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase border ${
                                    partido.estado_partido === "en_vivo" ? "bg-green-500/10 text-green-450 border-green-500/20" :
                                    partido.estado_partido === "finalizado" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                                    partido.estado_partido === "suspendido" ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                    partido.estado_partido === "demorado" ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" :
                                    "bg-zinc-800 text-zinc-400 border-zinc-700"
                                  }`}>{partido.estado_partido}</span>
                                </span>
                                {partido.cliente_id && (
                                  <span>Asignado a: <span className="text-[#ff7900]">{clientes.find(c => c.id === partido.cliente_id)?.nombre_medio}</span></span>
                                )}
                              </div>

                              {/* Fila de Edición de Jornada y Fecha/Hora en Super Admin */}
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mt-4 pt-3 border-t border-[#27272a]/65 text-xs">
                                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-zinc-400 font-bold uppercase whitespace-nowrap">Jornada:</span>
                                    <input
                                      type="text"
                                      value={partido.jornada || ""}
                                      placeholder="Ej. Fecha 10"
                                      onChange={e => handleUpdateJornada(partido.id, e.target.value)}
                                      className="bg-[#09090b] border border-[#27272a] rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-[#ff7900]/50 font-semibold w-[110px]"
                                    />
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-zinc-400 font-bold uppercase whitespace-nowrap">Fecha/Hora:</span>
                                    <input
                                      type="datetime-local"
                                      value={formatForDatetimeLocal(partido.fecha_hora)}
                                      onChange={e => handleUpdateFechaHora(partido.id, e.target.value)}
                                      className="bg-[#09090b] border border-[#27272a] rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-[#ff7900]/50 font-semibold"
                                    />
                                  </div>
                                </div>
                                {!partido.api_partido_id && (
                                  <button
                                    onClick={() => handleMoveMatchToToday(partido.id)}
                                    className="text-[9px] text-zinc-300 hover:text-white font-bold bg-[#09090b] hover:bg-zinc-800 px-2 py-1.5 rounded border border-[#27272a] transition-all flex items-center gap-1 shrink-0"
                                  >
                                    📅 Mover a Hoy
                                  </button>
                                )}
                              </div>
                              
                              {/* Acciones de Testeo para Partidos Profesionales */}
                              {partido.api_partido_id && (
                                <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-[#27272a]/65">
                                  <button
                                    onClick={() => handleMoveMatchToToday(partido.id)}
                                    className="text-[10px] text-zinc-300 hover:text-white font-bold bg-[#09090b] hover:bg-zinc-800 px-3 py-1.5 rounded-lg border border-[#27272a] transition-all flex items-center gap-1"
                                  >
                                    📅 Mover a Hoy
                                  </button>
                                  <button
                                    onClick={() => handleSyncMatchFromAPI(partido.api_partido_id!)}
                                    className="text-[10px] text-green-400 hover:text-green-350 font-bold bg-green-500/10 hover:bg-green-500/20 px-3 py-1.5 rounded-lg border border-green-500/20 transition-all flex items-center gap-1"
                                  >
                                    🔄 Sincronizar API
                                  </button>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

