"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import ProdeParticipantsManager from "@/components/ProdeParticipantsManager";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "futbol-widget": any;
    }
  }
  namespace React.JSX {
    interface IntrinsicElements {
      "futbol-widget": any;
    }
  }
}

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
  const [activeTab, setActiveTab] = useState<"clientes" | "ligas" | "partidos" | "integracion" | "noticias" | "prode_participantes">("clientes");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // States para Noticias / Carrusel
  const [newsList, setNewsList] = useState<any[]>([]);
  const [newsUrlInput, setNewsUrlInput] = useState("");
  const [extractingNews, setExtractingNews] = useState(false);
  const [extractedPreview, setExtractedPreview] = useState<any | null>(null);
  const [newsMsg, setNewsMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
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
  const [configColorSecundario, setConfigColorSecundario] = useState("#00E676");
  const [configColorFondoTarjeta, setConfigColorFondoTarjeta] = useState("#121214");
  const [configColorTextoPrincipal, setConfigColorTextoPrincipal] = useState("#f4f4f5");
  const [configColorTextoSecundario, setConfigColorTextoSecundario] = useState("#a1a1aa");
  const [configColorBorde1, setConfigColorBorde1] = useState("#7F35B2");
  const [configColorBorde2, setConfigColorBorde2] = useState("#EF426F");
  const [configFuenteFamilia, setConfigFuenteFamilia] = useState("sans-serif");
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
    let script = document.getElementById("muove-widget-script") as HTMLScriptElement;
    if (!script) {
      script = document.createElement("script");
      script.id = "muove-widget-script";
      script.src = "/widget.js";
      script.async = true;
      document.body.appendChild(script);
    }
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

      // 6. Noticias del carrusel
      await fetchNewsList();

    } catch (err) {
      console.error("Error al cargar datos:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchNewsList() {
    try {
      const res = await fetch("/api/news?all=true");
      const data = await res.json();
      if (res.ok && data.success) {
        setNewsList(data.noticias || []);
      }
    } catch (e) {
      console.error("Error al obtener noticias en SuperAdmin:", e);
    }
  }

  async function handleExtractNews(e: React.FormEvent) {
    e.preventDefault();
    if (!newsUrlInput.trim()) return;
    setNewsMsg(null);
    setExtractingNews(true);
    setExtractedPreview(null);

    try {
      const res = await fetch("/api/news/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newsUrlInput.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setExtractedPreview(data.data);
      } else {
        setNewsMsg({ type: "error", text: data.error || "No se pudieron extraer metadatos de la URL." });
      }
    } catch (e) {
      setNewsMsg({ type: "error", text: "Error de red al conectar con el servidor." });
    } finally {
      setExtractingNews(false);
    }
  }

  async function handleSaveExtractedNews() {
    if (!extractedPreview) return;
    setNewsMsg(null);

    try {
      const res = await fetch("/api/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(extractedPreview),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNewsMsg({ type: "success", text: "¡Noticia publicada con éxito en el carrusel!" });
        setNewsUrlInput("");
        setExtractedPreview(null);
        setNewsList(data.noticias || []);
      } else {
        setNewsMsg({ type: "error", text: data.error || "Error al guardar noticia." });
      }
    } catch (e) {
      setNewsMsg({ type: "error", text: "Error al guardar noticia." });
    }
  }

  async function handleToggleNews(id: string) {
    setNewsList((prev) => prev.map((n) => (n.id === id ? { ...n, active: !n.active } : n)));
    try {
      const res = await fetch("/api/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", id }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.noticias) {
        setNewsList(data.noticias);
      }
    } catch (e) {
      console.error("Error al alternar noticia:", e);
    }
  }

  async function handleDeleteNews(id: string) {
    setNewsList((prev) => prev.filter((n) => n.id !== id));
    try {
      const res = await fetch("/api/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.noticias) {
        setNewsList(data.noticias);
      }
    } catch (e) {
      console.error("Error al eliminar noticia:", e);
    }
  }

  async function handleMoveNews(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newsList.length) return;

    const updated = [...newsList];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    setNewsList(updated);

    try {
      const res = await fetch("/api/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reorder", newsList: updated }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.noticias) {
        setNewsList(data.noticias);
      }
    } catch (e) {
      console.error("Error al reordenar noticias:", e);
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
    setConfigColorSecundario("#00E676");
    setConfigColorFondoTarjeta("#121214");
    setConfigColorTextoPrincipal("#f4f4f5");
    setConfigColorTextoSecundario("#a1a1aa");
    setConfigColorBorde1("#7F35B2");
    setConfigColorBorde2("#EF426F");
    setConfigFuenteFamilia("sans-serif");
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
      setConfigColorPrimario(data.color_primario || "#121214");
      
      const rawSec = data.color_secundario || "#00E676";
      setConfigColorSecundario(rawSec.length <= 7 ? rawSec : "#00E676");
      
      let rawLogo = data.logo_medio_url || "";
      if (rawLogo.includes("___CFG___")) {
        const parts = rawLogo.split("___CFG___");
        rawLogo = parts[0];
        const cfg = parts[1] ? parts[1].split("|") : [];
        setConfigColorFondoTarjeta(cfg[0] || "#121214");
        setConfigColorTextoPrincipal(cfg[1] || "#f4f4f5");
        setConfigColorTextoSecundario(cfg[2] || "#a1a1aa");
        setConfigFuenteFamilia(cfg[3] || "sans-serif");
        setConfigColorBorde1(cfg[4] || "#7F35B2");
        setConfigColorBorde2(cfg[5] || "#EF426F");
      }
      setConfigLogoUrl(rawLogo);
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

      const baseLogo = logoUrl ? logoUrl.split("___CFG___")[0] : "";
      const extraConfig = `___CFG___${configColorFondoTarjeta}|${configColorTextoPrincipal}|${configColorTextoSecundario}|${configFuenteFamilia}|${configColorBorde1}|${configColorBorde2}`;
      const finalLogoPayload = baseLogo ? `${baseLogo}${extraConfig}` : extraConfig;

      const payload = {
        cliente_id: editingConfigClienteId,
        liga_id: null,
        color_primario: configColorPrimario.substring(0, 7),
        color_secundario: configColorSecundario.substring(0, 7),
        logo_medio_url: finalLogoPayload,
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
          <button
            onClick={() => setActiveTab("integracion")}
            className={`py-3 px-4 text-sm font-bold border-b-2 transition-all ${
              activeTab === "integracion"
                ? "border-[#ff7900] text-[#ff7900]"
                : "border-transparent text-zinc-400 hover:text-white"
            }`}
          >
            📦 Código para Vorks (iFrame & Widget)
          </button>
          <button
            onClick={() => setActiveTab("noticias")}
            className={`py-3 px-4 text-sm font-bold border-b-2 transition-all ${
              activeTab === "noticias"
                ? "border-[#ff7900] text-[#ff7900]"
                : "border-transparent text-zinc-400 hover:text-white"
            }`}
          >
            📰 Noticias / Carrusel
          </button>
          <button
            onClick={() => setActiveTab("prode_participantes")}
            className={`py-3 px-4 text-sm font-bold border-b-2 transition-all ${
              activeTab === "prode_participantes"
                ? "border-[#ff7900] text-[#ff7900]"
                : "border-transparent text-zinc-400 hover:text-white"
            }`}
          >
            🏆 Participantes Prode & Mensajes
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
                                <label className="block text-xs font-semibold text-zinc-400 mb-2">Color Fondo Panel Izquierdo (Sponsor)</label>
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
                                    className="w-full bg-[#121214] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white uppercase focus:outline-none font-mono"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-zinc-400 mb-2">Color Acento (Borde Animado & Detalles)</label>
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
                                    className="w-full bg-[#121214] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white uppercase focus:outline-none font-mono"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-zinc-400 mb-2">Color Fondo de Tarjeta de Partido</label>
                                <div className="flex gap-2">
                                  <input
                                    type="color"
                                    value={configColorFondoTarjeta}
                                    onChange={e => setConfigColorFondoTarjeta(e.target.value)}
                                    className="w-10 h-10 border-0 bg-transparent cursor-pointer rounded"
                                  />
                                  <input
                                    type="text"
                                    value={configColorFondoTarjeta}
                                    onChange={e => setConfigColorFondoTarjeta(e.target.value)}
                                    className="w-full bg-[#121214] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white uppercase focus:outline-none font-mono"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-zinc-400 mb-2">Color Texto Principal (Equipos & Goles)</label>
                                <div className="flex gap-2">
                                  <input
                                    type="color"
                                    value={configColorTextoPrincipal}
                                    onChange={e => setConfigColorTextoPrincipal(e.target.value)}
                                    className="w-10 h-10 border-0 bg-transparent cursor-pointer rounded"
                                  />
                                  <input
                                    type="text"
                                    value={configColorTextoPrincipal}
                                    onChange={e => setConfigColorTextoPrincipal(e.target.value)}
                                    className="w-full bg-[#121214] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white uppercase focus:outline-none font-mono"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-zinc-400 mb-2">Color Texto Secundario (Detalles & Fecha)</label>
                                <div className="flex gap-2">
                                  <input
                                    type="color"
                                    value={configColorTextoSecundario}
                                    onChange={e => setConfigColorTextoSecundario(e.target.value)}
                                    className="w-10 h-10 border-0 bg-transparent cursor-pointer rounded"
                                  />
                                  <input
                                    type="text"
                                    value={configColorTextoSecundario}
                                    onChange={e => setConfigColorTextoSecundario(e.target.value)}
                                    className="w-full bg-[#121214] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white uppercase focus:outline-none font-mono"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-zinc-400 mb-2">Color Borde Animado Principal (Glow 1)</label>
                                <div className="flex gap-2">
                                  <input
                                    type="color"
                                    value={configColorBorde1}
                                    onChange={e => setConfigColorBorde1(e.target.value)}
                                    className="w-10 h-10 border-0 bg-transparent cursor-pointer rounded"
                                  />
                                  <input
                                    type="text"
                                    value={configColorBorde1}
                                    onChange={e => setConfigColorBorde1(e.target.value)}
                                    className="w-full bg-[#121214] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white uppercase focus:outline-none font-mono"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-zinc-400 mb-2">Color Borde Animado Secundario (Glow 2)</label>
                                <div className="flex gap-2">
                                  <input
                                    type="color"
                                    value={configColorBorde2}
                                    onChange={e => setConfigColorBorde2(e.target.value)}
                                    className="w-10 h-10 border-0 bg-transparent cursor-pointer rounded"
                                  />
                                  <input
                                    type="text"
                                    value={configColorBorde2}
                                    onChange={e => setConfigColorBorde2(e.target.value)}
                                    className="w-full bg-[#121214] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white uppercase focus:outline-none font-mono"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-zinc-400 mb-2">Tipografía / Tipo de Letra</label>
                                <select
                                  value={configFuenteFamilia}
                                  onChange={e => setConfigFuenteFamilia(e.target.value)}
                                  className="w-full bg-[#121214] border border-[#27272a] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none font-semibold"
                                >
                                  <option value="sans-serif">Moderno Sans (System Default)</option>
                                  <option value="inter">Inter / Roboto (Limpio & Elegante)</option>
                                  <option value="montserrat">Montserrat / Outfit (Deportivo Bold)</option>
                                  <option value="poppins">Poppins / Rubik (Urbano & Moderno)</option>
                                  <option value="serif">Diario Tradicional / Prensa (Serif Classic)</option>
                                </select>
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

                            {/* Previsualización en Tiempo Real del Widget */}
                            <div className="border-t border-[#27272a] pt-4 mt-2 space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-[#ff7900]">👁️ Previsualización en Tiempo Real ({cliente.nombre_medio})</span>
                                <span className="text-[10px] text-zinc-500 font-mono">ID: {cliente.id}</span>
                              </div>
                              <p className="text-[11px] text-zinc-400">
                                Los cambios en colores y tipografía se reflejan al instante en la vista previa:
                              </p>
                              <div className="bg-[#121214] border border-[#27272a] rounded-xl p-4 shadow-inner">
                                <futbol-widget
                                  client-id={cliente.id}
                                  client-name={cliente.nombre_medio}
                                  primary-color={configColorPrimario}
                                  secondary-color={configColorSecundario}
                                  card-bg-color={configColorFondoTarjeta}
                                  main-text-color={configColorTextoPrincipal}
                                  sub-text-color={configColorTextoSecundario}
                                  border-color-1={configColorBorde1}
                                  border-color-2={configColorBorde2}
                                  font-family={configFuenteFamilia}
                                />
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

            {/* TAB INTEGRACIÓN PARA VORKS */}
            {activeTab === "integracion" && (
              <div className="space-y-6">
                <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 shadow-xl space-y-6">
                  <div className="flex items-center gap-3 border-b border-[#27272a] pb-4">
                    <span className="text-3xl">📦</span>
                    <div>
                      <h2 className="text-lg font-bold text-white">Código de Integración para Desarrolladores (Vorks)</h2>
                      <p className="text-xs text-zinc-400">
                        Copiá estos bloques de código para incrustar el Prode, Widget o APIs en la web principal de Data eNe.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    {/* Opción 1: iFrame Prode */}
                    <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-5 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <span>1️⃣</span> Incrustar Aplicación del Prode Completa (iFrame)
                          </h3>
                          <p className="text-xs text-zinc-400">
                            Recomendado para Vorks. Crea una página propia en Data eNe (ej. /prode) y pega este código HTML.
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`<iframe src="https://widget-futbol-muove.vercel.app/prode" style="width:100%; height:1100px; border:none;" allow="clipboard-write"></iframe>`);
                            setCopiedKey("iframe");
                            setTimeout(() => setCopiedKey(null), 2000);
                          }}
                          className="bg-[#ff7900] hover:bg-[#e06b00] text-black font-extrabold text-xs px-4 py-2 rounded-lg transition-all"
                        >
                          {copiedKey === "iframe" ? "✓ ¡Copiado!" : "📋 Copiar iFrame"}
                        </button>
                      </div>

                      <pre className="bg-[#18181b] text-emerald-400 p-4 rounded-lg text-xs overflow-x-auto border border-zinc-800 font-mono">
{`<iframe 
  src="https://widget-futbol-muove.vercel.app/prode" 
  style="width:100%; height:1100px; border:none;" 
  allow="clipboard-write">
</iframe>`}
                      </pre>
                    </div>

                    {/* Opción 2: Widget flotante JS */}
                    <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-5 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <span>2️⃣</span> Widget Flotante de Partidos (Script JS)
                          </h3>
                          <p className="text-xs text-zinc-400">
                            Pega este script en cualquier sección del sitio para desplegar el widget lateral de partidos.
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`<futbol-widget client-id="cc683950-7147-4638-b31f-a6810fcd73c0"></futbol-widget>\n<script src="https://widget-futbol-muove.vercel.app/widget.js"></script>`);
                            setCopiedKey("widget");
                            setTimeout(() => setCopiedKey(null), 2000);
                          }}
                          className="bg-[#ff7900] hover:bg-[#e06b00] text-black font-extrabold text-xs px-4 py-2 rounded-lg transition-all"
                        >
                          {copiedKey === "widget" ? "✓ ¡Copiado!" : "📋 Copiar Widget JS"}
                        </button>
                      </div>

                      <pre className="bg-[#18181b] text-amber-400 p-4 rounded-lg text-xs overflow-x-auto border border-zinc-800 font-mono">
{`<futbol-widget client-id="cc683950-7147-4638-b31f-a6810fcd73c0"></futbol-widget>
<script src="https://widget-futbol-muove.vercel.app/widget.js"></script>`}
                      </pre>
                    </div>

                    {/* Opción 3: Endpoints API REST */}
                    <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-5 space-y-3">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>3️⃣</span> Endpoints de APIs REST (JSON)
                      </h3>
                      <p className="text-xs text-zinc-400">
                        Si Vorks prefiere consumir los datos puros desde su propio backend o frontend.
                      </p>

                      <div className="space-y-2 text-xs font-mono">
                        <div className="flex items-center justify-between bg-[#18181b] p-3 rounded-lg border border-zinc-800">
                          <div>
                            <span className="text-blue-400 font-bold mr-2">GET</span>
                            <span className="text-zinc-300">https://widget-futbol-muove.vercel.app/api/goleadores</span>
                          </div>
                          <span className="text-[10px] text-zinc-500 font-sans">Tabla de Goleadores</span>
                        </div>

                        <div className="flex items-center justify-between bg-[#18181b] p-3 rounded-lg border border-zinc-800">
                          <div>
                            <span className="text-blue-400 font-bold mr-2">GET</span>
                            <span className="text-zinc-300">https://widget-futbol-muove.vercel.app/api/prode/standings</span>
                          </div>
                          <span className="text-[10px] text-zinc-500 font-sans">Tablas de Posiciones Zona A/B</span>
                        </div>

                        <div className="flex items-center justify-between bg-[#18181b] p-3 rounded-lg border border-zinc-800">
                          <div>
                            <span className="text-blue-400 font-bold mr-2">GET</span>
                            <span className="text-zinc-300">https://widget-futbol-muove.vercel.app/api/prode/leaderboard</span>
                          </div>
                          <span className="text-[10px] text-zinc-500 font-sans">Ranking General de Usuarios Prode</span>
                        </div>

                        <div className="flex items-center justify-between bg-[#18181b] p-3 rounded-lg border border-zinc-800">
                          <div>
                            <span className="text-blue-400 font-bold mr-2">GET</span>
                            <span className="text-zinc-300">https://widget-futbol-muove.vercel.app/api/news</span>
                          </div>
                          <span className="text-[10px] text-zinc-500 font-sans">Noticias Activas del Carrusel</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB NOTICIAS / CARRUSEL */}
            {activeTab === "noticias" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Formulario de extracción de URL */}
                <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 h-fit space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🔗</span>
                    <div>
                      <h2 className="text-lg font-bold text-white">Subir Noticia vía URL</h2>
                      <p className="text-xs text-zinc-400">Pegá el link de cualquier diario de Necochea</p>
                    </div>
                  </div>

                  <form onSubmit={handleExtractNews} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-2">
                        URL de la Noticia
                      </label>
                      <input
                        type="url"
                        placeholder="https://ecosdiarios.com/nota-ejemplo..."
                        value={newsUrlInput}
                        onChange={(e) => setNewsUrlInput(e.target.value)}
                        className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff7900]/50 transition-colors"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={extractingNews}
                      className="w-full bg-[#ff7900] hover:bg-[#e06b00] text-black font-extrabold py-3 rounded-xl transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {extractingNews ? (
                        <>
                          <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
                          <span>Extrayendo noticia...</span>
                        </>
                      ) : (
                        <span>🔍 Extraer Metadatos (Imagen y Título)</span>
                      )}
                    </button>
                  </form>

                  {newsMsg && (
                    <div
                      className={`p-3 rounded-xl text-xs font-bold text-center border ${
                        newsMsg.type === "success"
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                      }`}
                    >
                      {newsMsg.text}
                    </div>
                  )}

                  {/* Previsualización antes de publicar */}
                  {extractedPreview && (
                    <div className="bg-[#09090b] border border-[#ff7900]/40 rounded-xl p-4 space-y-3 mt-4">
                      <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                        <span className="text-xs font-bold text-[#ff7900]">✨ Previsualización Extraída</span>
                        <span className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded font-mono">
                          {extractedPreview.siteName}
                        </span>
                      </div>

                      <div className="h-32 rounded-lg overflow-hidden border border-zinc-800 relative">
                        <img
                          src={extractedPreview.image}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-zinc-400 mb-1">Título de la Nota</label>
                        <input
                          type="text"
                          value={extractedPreview.title}
                          onChange={(e) => setExtractedPreview({ ...extractedPreview, title: e.target.value })}
                          className="w-full bg-[#18181b] border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-zinc-400 mb-1">Resumen / Copete</label>
                        <textarea
                          rows={2}
                          value={extractedPreview.description}
                          onChange={(e) => setExtractedPreview({ ...extractedPreview, description: e.target.value })}
                          className="w-full bg-[#18181b] border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-300"
                        />
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={handleSaveExtractedNews}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs py-2.5 rounded-lg transition-all"
                        >
                          🚀 Publicar en Carrusel
                        </button>
                        <button
                          onClick={() => setExtractedPreview(null)}
                          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs px-3 py-2.5 rounded-lg"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Listado de Noticias en el Carrusel */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white">Noticias en el Carrusel ({newsList.length})</h2>
                    <span className="text-xs text-zinc-400">
                      {newsList.filter((n) => n.active).length} Activas
                    </span>
                  </div>

                  {newsList.length === 0 ? (
                    <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-8 text-center text-zinc-500 text-sm">
                      No hay noticias publicadas en el carrusel aún. Pega una URL a la izquierda para empezar.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {newsList.map((item, index) => (
                        <div
                          key={item.id}
                          className={`bg-[#121214] border rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 transition-all ${
                            item.active ? "border-[#27272a] hover:border-zinc-700" : "border-zinc-800 opacity-60 bg-zinc-950"
                          }`}
                        >
                          <div className="flex items-center gap-3 w-full md:w-auto flex-1">
                            {/* Botones de Reordenar ▲ / ▼ */}
                            <div className="flex flex-col gap-1 shrink-0">
                              <button
                                disabled={index === 0}
                                onClick={() => handleMoveNews(index, "up")}
                                className="w-6 h-6 rounded bg-[#18181b] border border-zinc-700 hover:border-[#ff7900] hover:text-[#ff7900] disabled:opacity-25 text-[10px] font-black flex items-center justify-center transition-all"
                                title="Subir orden"
                              >
                                ▲
                              </button>
                              <button
                                disabled={index === newsList.length - 1}
                                onClick={() => handleMoveNews(index, "down")}
                                className="w-6 h-6 rounded bg-[#18181b] border border-zinc-700 hover:border-[#ff7900] hover:text-[#ff7900] disabled:opacity-25 text-[10px] font-black flex items-center justify-center transition-all"
                                title="Bajar orden"
                              >
                                ▼
                              </button>
                            </div>

                            {/* Badge Posición */}
                            <span className="w-6 text-center text-xs font-black text-[#ff7900] bg-[#ff7900]/10 py-1 rounded-md border border-[#ff7900]/20 shrink-0">
                              #{index + 1}
                            </span>

                            <img
                              src={item.image}
                              alt=""
                              className="w-20 h-16 rounded-lg object-cover border border-zinc-800 shrink-0 ml-1"
                            />
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="bg-[#ff7900]/20 text-[#ff7900] text-[10px] font-extrabold px-2 py-0.5 rounded">
                                  {item.siteName}
                                </span>
                                <span className="text-[10px] text-zinc-500">
                                  {new Date(item.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                              <h3 className="text-sm font-bold text-white line-clamp-1">{item.title}</h3>
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-zinc-400 hover:text-[#ff7900] underline line-clamp-1"
                              >
                                {item.url}
                              </a>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleToggleNews(item.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border transition-all ${
                                item.active
                                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                                  : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700"
                              }`}
                            >
                              {item.active ? "✓ Activa" : "👁 Oculta"}
                            </button>
                            <button
                              onClick={() => handleDeleteNews(item.id)}
                              className="px-3 py-1.5 rounded-lg text-xs font-extrabold bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 transition-all"
                            >
                              🗑 Eliminar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB PARTICIPANTES PRODE & REMISIÓN */}
            {activeTab === "prode_participantes" && (
              <ProdeParticipantsManager isSuperAdmin={true} clientesList={clientes} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

