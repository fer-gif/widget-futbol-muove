"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { supabase } from "@/lib/supabase";

type Cliente = {
  id: string;
  nombre_medio: string;
  estado: string;
};

type Liga = {
  id: string;
  nombre_liga: string;
  es_profesional: boolean;
};

export default function DocsPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [ligas, setLigas] = useState<Liga[]>([]);
  const [loading, setLoading] = useState(true);

  // States de personalización
  const [selectedClienteId, setSelectedClienteId] = useState<string>("");
  const [selectedLeagues, setSelectedLeagues] = useState<string[]>([]);
  
  // Script dynamically injected indicator
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [previewKey, setPreviewKey] = useState(0); // Para forzar el re-render del custom element

  useEffect(() => {
    fetchConfigData();
  }, []);

  async function fetchConfigData() {
    setLoading(true);
    try {
      const { data: dataClientes } = await supabase
        .from("clientes")
        .select("id, nombre_medio, estado")
        .eq("estado", "activo");
      setClientes(dataClientes || []);

      const { data: dataLigas } = await supabase
        .from("ligas")
        .select("id, nombre_liga, es_profesional");
      setLigas(dataLigas || []);

      if (dataClientes && dataClientes.length > 0) {
        setSelectedClienteId(dataClientes[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleLeagueToggle(id: string) {
    if (selectedLeagues.includes(id)) {
      setSelectedLeagues(selectedLeagues.filter(lId => lId !== id));
    } else {
      setSelectedLeagues([...selectedLeagues, id]);
    }
    // Forzar recarga del custom element
    setPreviewKey(prev => prev + 1);
  }

  const selectedClienteName = clientes.find(c => c.id === selectedClienteId)?.nombre_medio || "Diario";
  const leaguesString = selectedLeagues.join(",");

  const hostUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

  const codeSnippet = `<!-- 1. Contenedor de Marcadores de Fútbol -->
<futbol-widget 
  client-id="${selectedClienteId || "TU-CLIENT-ID-AQUI"}" 
  leagues="${leaguesString}"
  client-name="${selectedClienteName}">
</futbol-widget>

<!-- 2. Script de Carga de Muove Widgets -->
<script src="${hostUrl}/widget.js" defer></script>`;

  function handleCopy() {
    navigator.clipboard.writeText(codeSnippet);
    alert("¡Código de integración copiado al portapapeles!");
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] font-sans pb-16">
      {/* Header */}
      <header className="border-b border-[#27272a] bg-[#121214] py-6 px-8 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wide">
              MUOVE <span className="text-[#ff7900]">| CÓDIGO DE INTEGRACIÓN</span>
            </h1>
            <p className="text-xs text-zinc-400 mt-1">Generador de códigos HTML y guía de integración para medios</p>
          </div>
          <Link href="/" className="text-xs text-zinc-400 hover:text-[#ff7900] border border-zinc-800 hover:border-[#ff7900]/30 px-4 py-2 rounded-xl bg-[#09090b] transition-all">
            ← Volver al Inicio
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Panel de Configuración */}
        <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 h-fit space-y-6">
          <h2 className="text-lg font-bold text-white mb-2">1. Personalizar Widget</h2>

          {loading ? (
            <div className="space-y-4">
              <div className="h-10 bg-[#09090b] rounded-xl animate-pulse"></div>
              <div className="h-20 bg-[#09090b] rounded-xl animate-pulse"></div>
            </div>
          ) : (
            <>
              {/* Cliente */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-2">Seleccionar Cliente Activo</label>
                <select
                  value={selectedClienteId}
                  onChange={e => {
                    setSelectedClienteId(e.target.value);
                    setPreviewKey(prev => prev + 1);
                  }}
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff7900]/50 transition-colors"
                >
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre_medio}</option>
                  ))}
                </select>
              </div>

              {/* Ligas */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-2">Seleccionar Ligas a Incluir</label>
                {ligas.length === 0 ? (
                  <p className="text-xs text-zinc-500">No hay ligas registradas.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {ligas.map(liga => (
                      <label key={liga.id} className="flex items-center gap-2.5 p-2.5 bg-[#09090b] border border-[#27272a] rounded-xl text-xs text-zinc-300 cursor-pointer hover:border-zinc-800 transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedLeagues.includes(liga.id)}
                          onChange={() => handleLeagueToggle(liga.id)}
                          className="w-4 h-4 accent-[#ff7900]"
                        />
                        <div>
                          <span className="font-bold block text-white">{liga.nombre_liga}</span>
                          <span className="text-[10px] text-zinc-500">
                            {liga.es_profesional ? "Automatizada" : "Local / Manual"}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Panel del Generador de Código y Vista Previa */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Vista Previa en Vivo */}
          <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4">Vista Previa del Widget en Tiempo Real</h2>
            
            <div 
              key={previewKey}
              className="border border-[#27272a] rounded-xl overflow-hidden bg-[#09090b] p-4 min-h-[187px] flex items-center justify-center"
              dangerouslySetInnerHTML={{
                __html: scriptLoaded && selectedClienteId 
                  ? `<futbol-widget client-id="${selectedClienteId}" leagues="${leaguesString}" client-name="${selectedClienteName}"></futbol-widget>`
                  : `<div class="text-center py-10 text-xs text-zinc-500">${!selectedClienteId ? "Selecciona un cliente para ver la vista previa." : "Inyectando cargador de widgets..."}</div>`
              }}
            />
            
            <p className="text-xs text-zinc-500 mt-3 leading-relaxed">
              * El bloque izquierdo mostrará el logo personalizado del diario o del sponsor si está configurado en el panel. El carrusel horizontal es completamente responsivo.
            </p>
          </div>

          {/* Código de Integración */}
          <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-white">Código de Integración HTML</h2>
              <button
                onClick={handleCopy}
                className="text-xs bg-[#ff7900] hover:bg-[#e06b00] text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                Copiar Código
              </button>
            </div>
            
            <div className="relative">
              <pre className="bg-[#09090b] border border-[#27272a] rounded-xl p-4 overflow-x-auto text-xs text-zinc-300 font-mono leading-relaxed select-all">
                {codeSnippet}
              </pre>
            </div>

            <div className="mt-6 space-y-3 text-xs text-zinc-400">
              <p className="font-bold text-white">Instrucciones de Instalación:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Copiá el bloque de código de arriba presionando el botón.</li>
                <li>Pegalo en cualquier sección de tu página web (ej: entre párrafos o en la sección deportiva).</li>
                <li>El widget cargará de forma asíncrona (gracias a <code className="text-[#ff7900]">defer</code>), por lo que no ralentizará la velocidad de carga de tu diario.</li>
              </ul>
            </div>
          </div>

        </div>

      </main>
      
      <Script 
        src="/widget.js" 
        strategy="afterInteractive" 
        onLoad={() => setScriptLoaded(true)} 
      />
    </div>
  );
}
