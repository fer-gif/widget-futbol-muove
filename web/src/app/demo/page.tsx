"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";

export default function DemoVentaWidget() {
  const [nombreDiario, setNombreDiario] = useState("Diario Ejemplo");
  const [colorPrimario, setColorPrimario] = useState("#121214");
  const [colorSecundario, setColorSecundario] = useState("#00E676");
  const [copiedCode, setCopiedCode] = useState(false);
  const widgetContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Cargar el script de widget.js si no existe
    let script = document.getElementById("muove-widget-script") as HTMLScriptElement;
    if (!script) {
      script = document.createElement("script");
      script.id = "muove-widget-script";
      script.src = "/widget.js";
      script.async = true;
      document.body.appendChild(script);
    }

    const renderDemoWidget = () => {
      if (!widgetContainerRef.current) return;
      widgetContainerRef.current.innerHTML = "";

      const widgetEl = document.createElement("futbol-widget");
      // Seteamos atributos de demo en vivo
      widgetEl.setAttribute("client-name", nombreDiario);
      widgetEl.setAttribute("primary-color", colorPrimario);
      widgetEl.setAttribute("secondary-color", colorSecundario);

      widgetContainerRef.current.appendChild(widgetEl);
    };

    if (window.customElements && window.customElements.get("futbol-widget")) {
      renderDemoWidget();
    } else {
      script.onload = () => {
        renderDemoWidget();
      };
    }
  }, [nombreDiario, colorPrimario, colorSecundario]);

  const embedCodeSnippet = `<!-- Widget Fútbol Muove | Resultados en Vivo -->\n<script src="https://widget-futbol-muove.vercel.app/widget.js" data-client-id="TU_ID_DE_DIARIO"></script>\n<futbol-widget></futbol-widget>`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(embedCodeSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] font-sans pb-20 selection:bg-[#00E676] selection:text-black">
      {/* Top Banner de Comercialización */}
      <div className="bg-gradient-to-r from-[#7F35B2] to-[#EF426F] py-2.5 px-4 text-center text-xs font-bold text-white shadow-md">
        🚀 DEMOSTRACIÓN COMERCIAL — Presentación del Widget de Fútbol para Diarios y Portales Digitales
      </div>

      {/* Header */}
      <header className="border-b border-[#27272a] bg-[#121214]/80 backdrop-blur py-5 px-6 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#7F35B2] to-[#00E676] flex items-center justify-center font-black text-black text-lg shadow-lg">
              ⚽
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-wide">
                MUOVE <span className="text-[#00E676]">WIDGET</span>
              </h1>
              <p className="text-[11px] text-zinc-400">Resultados en vivo para diarios digitales</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="text-xs bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-zinc-300 font-semibold px-4 py-2 rounded-xl transition-all"
            >
              🔐 Acceso Periodistas
            </Link>
            <a
              href="https://agenciamuove.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs bg-[#00E676] hover:bg-[#00c865] text-black font-bold px-4 py-2 rounded-xl transition-all shadow-lg shadow-[#00E676]/20"
            >
              Contactar a Muove ➔
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-10 space-y-12">
        {/* Titular Comercial */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <span className="inline-block bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20 text-xs px-3.5 py-1 rounded-full font-bold uppercase tracking-wider">
            Potenciá tu Diario Digital
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            El widget de marcadores en vivo que <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00E676] to-[#7F35B2]">engancha a tus lectores</span>
          </h2>
          <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
            Ofrecé los resultados de la Liga Local y Torneos en tiempo real directamente en la portada de tu portal de noticias. Sin esfuerzo para tu redacción, 100% automático y adaptable a tu identidad visual.
          </p>
        </div>

        {/* Panel Interactivo de Demostración */}
        <div className="bg-[#121214] border border-[#27272a] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#27272a] pb-6">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>👁️</span> Previsualización en Tiempo Real
              </h3>
              <p className="text-xs text-zinc-400">Probá cómo lucirá el widget embebido en la portada de tu diario.</p>
            </div>

            {/* Simulador de Colores y Nombre */}
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto bg-[#09090b] p-3 rounded-2xl border border-[#27272a]">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-zinc-400">Nombre Diario:</span>
                <input
                  type="text"
                  value={nombreDiario}
                  onChange={(e) => setNombreDiario(e.target.value)}
                  className="bg-[#18181b] border border-[#27272a] text-white text-xs px-3 py-1.5 rounded-xl font-semibold focus:outline-none focus:border-[#00E676] w-36"
                  placeholder="Ej. Diario El Faro"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-zinc-400">Color Marca:</span>
                <input
                  type="color"
                  value={colorSecundario}
                  onChange={(e) => setColorSecundario(e.target.value)}
                  className="w-8 h-8 rounded-lg bg-transparent border-0 cursor-pointer"
                  title="Elegir color secundario de marca"
                />
              </div>
            </div>
          </div>

          {/* Contenedor del Widget en Vivo */}
          <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-4 sm:p-6 shadow-inner">
            <div ref={widgetContainerRef} className="w-full">
              <div className="text-center py-10 text-xs text-zinc-500 animate-pulse">
                Cargando widget interactivo de demostración...
              </div>
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 text-center">
            * Este widget es una muestra en vivo con partidos reales de la Liga Necochea. Las fechas y goles se actualizan automáticamente durante los encuentros.
          </p>
        </div>

        {/* Beneficios Comerciales para los Diarios */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 space-y-3 hover:border-[#00E676]/40 transition-all">
            <div className="w-10 h-10 rounded-xl bg-[#00E676]/10 text-[#00E676] flex items-center justify-center text-xl font-bold">
              ⚡
            </div>
            <h4 className="text-base font-bold text-white">0% Carga de Trabajo</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              No requiere que tus periodistas pierdan tiempo cargando marcadores. Los resultados son transmitidos y verificados en tiempo real por el equipo central de Muove.
            </p>
          </div>

          <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 space-y-3 hover:border-[#7F35B2]/40 transition-all">
            <div className="w-10 h-10 rounded-xl bg-[#7F35B2]/10 text-[#7F35B2] flex items-center justify-center text-xl font-bold">
              📱
            </div>
            <h4 className="text-base font-bold text-white">100% Adaptable a Celulares</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Diseño ultra optimizado en formato responsive. En celulares se transforma automáticamente en una barra superior fluida para maximizar el espacio de lectura.
            </p>
          </div>

          <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 space-y-3 hover:border-[#EF426F]/40 transition-all">
            <div className="w-10 h-10 rounded-xl bg-[#EF426F]/10 text-[#EF426F] flex items-center justify-center text-xl font-bold">
              🎨
            </div>
            <h4 className="text-base font-bold text-white">Integración con Tu Marca</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Personalizamos el widget con el logo corporativo de tu diario digital, tus colores institucionales y espacio disponible para sponsors locales.
            </p>
          </div>
        </div>

        {/* Sección de Instalación Fáciles en 30 Segundos */}
        <div className="bg-gradient-to-b from-[#121214] to-[#18181b] border border-[#27272a] rounded-3xl p-6 sm:p-10 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-xl font-bold text-white">💻 Instalación en 30 Segundos</h3>
              <p className="text-xs text-zinc-400">Funciona en cualquier sitio web: WordPress, HTML5, Drupal, Laravel, etc.</p>
            </div>

            <button
              onClick={handleCopyCode}
              className="bg-[#00E676] hover:bg-[#00c865] text-black font-bold px-5 py-2.5 rounded-xl transition-all text-xs flex items-center gap-2 shadow-lg shadow-[#00E676]/20"
            >
              {copiedCode ? "✓ ¡Código Copiado!" : "📋 Copiar Código iFrame / Script"}
            </button>
          </div>

          <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-5 font-mono text-xs text-zinc-300 overflow-x-auto relative">
            <pre className="whitespace-pre-wrap leading-relaxed">
              {embedCodeSnippet}
            </pre>
          </div>
        </div>

        {/* Call to Action Final */}
        <div className="bg-gradient-to-tr from-[#7F35B2]/20 via-[#121214] to-[#00E676]/20 border border-[#27272a] rounded-3xl p-8 sm:p-12 text-center space-y-5">
          <h3 className="text-2xl sm:text-3xl font-black text-white">¿Querés sumar este widget a tu diario digital?</h3>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto">
            Contactate con nuestro equipo comercial para activar la licencia de tu medio digital y personalizar tus colores hoy mismo.
          </p>
          <div className="pt-2">
            <a
              href="https://agenciamuove.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-[#00E676] hover:bg-[#00c865] text-black font-extrabold px-8 py-3.5 rounded-xl transition-all text-sm shadow-xl shadow-[#00E676]/20"
            >
              Solicitar Licencia para Mi Diario ➔
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
