"use client";

import { useEffect, useState, useRef } from "react";

export interface NewsArticle {
  id: string;
  url: string;
  title: string;
  image: string;
  description: string;
  siteName: string;
  active: boolean;
  createdAt: string;
}

export default function NewsCarousel() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchNews();
  }, []);

  async function fetchNews() {
    try {
      const res = await fetch("/api/news");
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.noticias)) {
        setArticles(data.noticias);
      }
    } catch (e) {
      console.error("Error al cargar noticias:", e);
    } finally {
      setLoading(false);
    }
  }

  // Rotación automática de noticias
  useEffect(() => {
    if (articles.length <= 1 || isPaused) return;

    timerRef.current = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % articles.length);
    }, 5000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [articles.length, isPaused]);

  if (loading) {
    return (
      <div className="w-full max-w-5xl mx-auto mb-4 px-2">
        <div className="h-44 md:h-52 bg-slate-100 animate-pulse rounded-2xl border border-slate-200 flex items-center justify-center text-xs text-slate-400 font-bold">
          Cargando noticias de la Liga de Necochea...
        </div>
      </div>
    );
  }

  if (articles.length === 0) {
    return null; // Si no hay noticias cargadas, no muestra el espacio
  }

  const current = articles[currentIndex];

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? articles.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % articles.length);
  };

  return (
    <div
      className="w-full max-w-5xl mx-auto mb-4 px-2"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="relative overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 shadow-lg group">
        {/* Fondo con imagen y overlay oscuro */}
        <div className="absolute inset-0 z-0">
          <img
            src={current.image}
            alt={current.title}
            className="w-full h-full object-cover opacity-45 scale-105 transition-all duration-700 blur-[1px]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent" />
        </div>

        {/* Contenido de la Noticia */}
        <div className="relative z-10 p-5 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4 min-h-[180px] md:min-h-[200px]">
          {/* Lado Izquierdo: Info & Texto */}
          <div className="flex-1 space-y-2 text-left">
            <h3 className="text-base md:text-xl font-black text-white leading-snug line-clamp-2 drop-shadow-sm">
              {current.title}
            </h3>

            {current.description && (
              <p className="text-xs md:text-sm text-slate-300 line-clamp-2 font-normal leading-relaxed max-w-3xl">
                {current.description}
              </p>
            )}

            <div className="pt-1">
              <a
                href={current.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-black text-[#EF426F] hover:text-white transition-colors group/btn"
              >
                <span>Leer nota completa</span>
                <span className="group-hover/btn:translate-x-1 transition-transform">↗</span>
              </a>
            </div>
          </div>

          {/* Lado Derecho: Imagen Destacada de Vista Previa (En Desktop) */}
          <div className="hidden sm:block shrink-0 w-36 h-28 md:w-44 md:h-32 rounded-xl overflow-hidden border border-white/10 shadow-md">
            <img
              src={current.image}
              alt=""
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>
        </div>

        {/* Flecha Izquierda */}
        {articles.length > 1 && (
          <button
            onClick={handlePrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/40 hover:bg-[#EF426F] text-white flex items-center justify-center transition-all opacity-80 group-hover:opacity-100 backdrop-blur-xs"
            aria-label="Noticia anterior"
          >
            ‹
          </button>
        )}

        {/* Flecha Derecha */}
        {articles.length > 1 && (
          <button
            onClick={handleNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/40 hover:bg-[#EF426F] text-white flex items-center justify-center transition-all opacity-80 group-hover:opacity-100 backdrop-blur-xs"
            aria-label="Siguiente noticia"
          >
            ›
          </button>
        )}

        {/* Indicadores de Puntos (Dots) */}
        {articles.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
            {articles.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-1.5 rounded-full transition-all ${
                  currentIndex === idx ? "w-6 bg-[#EF426F]" : "w-1.5 bg-white/40 hover:bg-white/70"
                }`}
                aria-label={`Ir a noticia ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
