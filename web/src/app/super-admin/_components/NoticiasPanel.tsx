"use client";

// Pestaña Noticias / Carrusel del super-admin.
import { useEffect, useState } from "react";

type Noticia = {
  id: string;
  url: string;
  title: string;
  image: string;
  description: string;
  siteName: string;
  active: boolean;
  createdAt: string;
};

export default function NoticiasPanel() {
  const [newsList, setNewsList] = useState<Noticia[]>([]);
  const [newsUrlInput, setNewsUrlInput] = useState("");
  const [extractingNews, setExtractingNews] = useState(false);
  const [extractedPreview, setExtractedPreview] = useState<Partial<Noticia> | null>(null);
  const [newsMsg, setNewsMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  

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

  useEffect(() => {
    // Carga inicial de la lista desde el servidor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNewsList();
  }, []);

  return (

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
  );
}
