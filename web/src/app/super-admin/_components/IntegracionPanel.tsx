"use client";

// Generador del código de inserción del widget, por medio, con vista previa.
import { useMemo, useState } from "react";
import { toast } from "@/components/Toaster";

type Props = {
  clientes: { id: string; nombre_medio: string; estado: string }[];
  ligas: { id: string; nombre_liga: string }[];
  suscripciones: { cliente_id: string; liga_id: string }[];
};

const TABS = [
  { id: "posiciones", label: "Posiciones" },
  { id: "goleadores", label: "Goleadores" },
] as const;

function appOrigin() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return typeof window !== "undefined" ? window.location.origin : "https://widget-futbol-muove.vercel.app";
}

async function copiar(texto: string, aviso: string) {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success(aviso);
  } catch {
    toast.error("No se pudo copiar. Seleccioná el texto y copialo a mano.");
  }
}

export default function IntegracionPanel({ clientes, ligas, suscripciones }: Props) {
  const activos = clientes.filter((c) => c.estado === "activo");
  const [clienteId, setClienteId] = useState(activos[0]?.id || "");
  const [tema, setTema] = useState(""); // "" = el configurado en el medio
  const [usarTabsPropias, setUsarTabsPropias] = useState(false);
  const [tabs, setTabs] = useState<string[]>(["posiciones", "goleadores"]);
  const [ligasSel, setLigasSel] = useState<string[]>([]);

  const origin = appOrigin();
  const ligasDelMedio = useMemo(() => {
    const ids = suscripciones.filter((s) => s.cliente_id === clienteId).map((s) => s.liga_id);
    return ids.length ? ligas.filter((l) => ids.includes(l.id)) : ligas;
  }, [clienteId, ligas, suscripciones]);

  const attrs = useMemo(() => {
    const a: [string, string][] = [["client-id", clienteId]];
    if (ligasSel.length) a.push(["leagues", ligasSel.join(",")]);
    if (tema) a.push(["theme", tema]);
    if (usarTabsPropias) a.push(["tabs", ["partidos", ...tabs].join(",")]);
    return a;
  }, [clienteId, ligasSel, tema, usarTabsPropias, tabs]);

  const codigo =
    `<futbol-widget ${attrs.map(([k, v]) => `${k}="${v}"`).join(" ")}></futbol-widget>\n` +
    `<script src="${origin}/widget.js" defer></script>`;

  const embeds = [
    { id: "partidos", titulo: "⚽ Partidos / En vivo", alto: 460 },
    { id: "posiciones", titulo: "📊 Tabla de posiciones", alto: 550 },
    { id: "goleadores", titulo: "👟 Goleadores", alto: 500 },
  ];

  const apis = [
    ["/api/widget?client-id=<ID>", "Partidos y estilo de un medio"],
    ["/api/prode/standings", "Posiciones Zona A/B"],
    ["/api/goleadores", "Tabla de goleadores"],
    ["/api/prode/leaderboard", "Ranking del Prode"],
    ["/api/news", "Noticias activas del carrusel"],
  ];

  return (
    <div className="space-y-6">
      {/* 1. Generador del widget */}
      <section className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-white">🧩 Código del widget para un medio</h2>
          <p className="text-xs text-zinc-400">
            Elegí el medio y las opciones. El código se pega una vez en el sitio (por ejemplo en la barra lateral);
            los colores, el logo y el sponsor se siguen cambiando desde la pestaña Clientes sin tocar el sitio.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="block">
            <span className="block text-xs font-semibold text-zinc-400 mb-2">Medio</span>
            <select
              value={clienteId}
              onChange={(e) => {
                setClienteId(e.target.value);
                setLigasSel([]);
              }}
              className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#ff7900]/50"
            >
              {activos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre_medio}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-xs font-semibold text-zinc-400 mb-2">Tema</span>
            <select
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#ff7900]/50"
            >
              <option value="">El configurado para el medio</option>
              <option value="oscuro">🌙 Oscuro</option>
              <option value="claro">☀️ Claro</option>
              <option value="auto">🌓 Automático</option>
            </select>
          </label>

          <fieldset>
            <legend className="block text-xs font-semibold text-zinc-400 mb-2">Pestañas</legend>
            <label className="flex items-center gap-2 text-xs text-zinc-300 mb-2">
              <input
                type="checkbox"
                checked={usarTabsPropias}
                onChange={(e) => setUsarTabsPropias(e.target.checked)}
                className="accent-[#ff7900]"
              />
              Forzar en este código (si no, usa la configuración del medio)
            </label>
            {usarTabsPropias && (
              <div className="flex gap-3">
                {TABS.map((t) => (
                  <label key={t.id} className="flex items-center gap-1.5 text-xs text-zinc-300">
                    <input
                      type="checkbox"
                      checked={tabs.includes(t.id)}
                      onChange={(e) => setTabs(e.target.checked ? [...tabs, t.id] : tabs.filter((x) => x !== t.id))}
                      className="accent-[#ff7900]"
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        </div>

        {ligasDelMedio.length > 1 && (
          <fieldset>
            <legend className="text-xs font-semibold text-zinc-400 mb-2">
              Ligas a mostrar <span className="text-zinc-500 font-normal">(ninguna marcada = todas las del medio)</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {ligasDelMedio.map((l) => {
                const on = ligasSel.includes(l.id);
                return (
                  <button
                    key={l.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setLigasSel(on ? ligasSel.filter((x) => x !== l.id) : [...ligasSel, l.id])}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                      on ? "bg-[#ff7900] text-black border-[#ff7900]" : "bg-[#09090b] text-zinc-400 border-[#27272a] hover:text-white"
                    }`}
                  >
                    {l.nombre_liga}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-300">Código para pegar en el sitio</span>
            <button
              type="button"
              onClick={() => copiar(codigo, "Código del widget copiado.")}
              disabled={!clienteId}
              className="bg-[#ff7900] hover:bg-[#e06b00] text-black font-extrabold text-xs px-4 py-2 rounded-lg disabled:opacity-40"
            >
              📋 Copiar código
            </button>
          </div>
          <pre className="bg-[#09090b] text-amber-300 p-4 rounded-xl text-xs overflow-x-auto border border-[#27272a] font-mono whitespace-pre-wrap break-all">
            {codigo}
          </pre>
        </div>

        {clienteId && (
          <div className="space-y-2">
            <span className="text-xs font-bold text-zinc-300">Vista previa (así se verá en el sitio)</span>
            <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-4">
              {/* "preview" evita sumar impresiones a las métricas del medio */}
              <futbol-widget key={codigo} preview="" {...Object.fromEntries(attrs)} />
            </div>
          </div>
        )}
      </section>

      {/* 2. Embeds para notas */}
      <section className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-white">📰 Incrustar en una nota (iFrame)</h2>
          <p className="text-xs text-zinc-400">Para pegar dentro del cuerpo de una nota, como un tuit o un video.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {embeds.map((e) => {
            const url = `${origin}/embed/${e.id}`;
            const iframe = `<iframe src="${url}" style="width:100%; height:${e.alto}px; border:none; border-radius:12px;" loading="lazy"></iframe>`;
            return (
              <div key={e.id} className="bg-[#09090b] border border-[#27272a] rounded-xl p-4 space-y-3">
                <div className="text-sm font-bold text-white">{e.titulo}</div>
                <button
                  type="button"
                  onClick={() => copiar(iframe, "iFrame copiado.")}
                  className="w-full bg-[#ff7900] hover:bg-[#e06b00] text-black font-extrabold text-xs py-2 rounded-lg"
                >
                  📋 Copiar iFrame
                </button>
                <button
                  type="button"
                  onClick={() => copiar(url, "Enlace copiado.")}
                  className="w-full bg-[#18181b] hover:bg-zinc-800 text-zinc-300 border border-zinc-700 font-bold text-xs py-2 rounded-lg"
                >
                  🔗 Copiar enlace
                </button>
              </div>
            );
          })}
        </div>
        <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-white">🏆 App completa del Prode</div>
            <p className="text-xs text-zinc-400">Para una página propia del medio (por ejemplo /prode).</p>
          </div>
          <button
            type="button"
            onClick={() =>
              copiar(
                `<iframe src="${origin}/prode${clienteId ? `?client-id=${clienteId}` : ""}" style="width:100%; height:1100px; border:none;" loading="lazy"></iframe>`,
                "iFrame del Prode copiado."
              )
            }
            className="bg-[#ff7900] hover:bg-[#e06b00] text-black font-extrabold text-xs px-4 py-2 rounded-lg"
          >
            📋 Copiar iFrame del Prode
          </button>
        </div>
      </section>

      {/* 3. APIs */}
      <section className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 space-y-3">
        <h2 className="text-lg font-bold text-white">🔌 APIs públicas (JSON)</h2>
        <div className="space-y-2 text-xs font-mono">
          {apis.map(([ruta, desc]) => (
            <div key={ruta} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 bg-[#09090b] p-3 rounded-lg border border-[#27272a]">
              <span className="break-all">
                <span className="text-blue-400 font-bold mr-2">GET</span>
                <span className="text-zinc-300">
                  {origin}
                  {ruta}
                </span>
              </span>
              <span className="text-[10px] text-zinc-500 font-sans">{desc}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
