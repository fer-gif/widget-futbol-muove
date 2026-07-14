import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#09090b] text-[#f4f4f5] font-sans">
      {/* Header */}
      <header className="border-b border-[#27272a] py-6 px-8 bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xl tracking-wider text-white">
              MUOVE <span className="text-[#ff7900]">| WIDGETS</span>
            </span>
          </div>
          <span className="text-xs bg-[#27272a] text-zinc-400 py-1 px-3 rounded-full font-medium border border-zinc-800">
            SaaS MVP v1.0
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col items-center justify-center px-4 py-16 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white mb-6">
            Plataforma de Widgets de <span className="text-[#ff7900]">Fútbol en Vivo</span>
          </h1>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Ecosistema de widgets integrables y autogestionables para diarios digitales y radios locales. Potenciado con el diseño premium y la velocidad de Muove.
          </p>
        </div>

        {/* Dashboard Panels Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl px-4">
          
          {/* Card 1: Super Admin */}
          <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-8 hover:border-[#ff7900]/50 transition-all group flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 bg-[#ff7900]/10 border border-[#ff7900]/20 rounded-xl flex items-center justify-center text-[#ff7900] mb-6 group-hover:scale-105 transition-transform">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Super Administrador</h2>
              <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                Creación y suspensión de diarios (bajas por falta de pago), configuración global de colores, logos de sponsors y vinculación de ligas profesionales/locales.
              </p>
            </div>
            <Link 
              href="/super-admin"
              className="inline-flex items-center justify-center bg-[#27272a] hover:bg-zinc-800 text-white font-semibold py-3 px-5 rounded-xl border border-zinc-700 hover:border-zinc-600 transition-colors w-full text-center"
            >
              Ir a Panel Control
            </Link>
          </div>

          {/* Card 2: Periodista CMS */}
          <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-8 hover:border-[#ff7900]/50 transition-all group flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 bg-[#ff7900]/10 border border-[#ff7900]/20 rounded-xl flex items-center justify-center text-[#ff7900] mb-6 group-hover:scale-105 transition-transform">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Panel de Periodistas</h2>
              <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                Carga rápida de partidos locales y actualización móvil en vivo. Sumar goles, finalizar partidos y gestionar el fixture desde la cancha sin intermediarios.
              </p>
            </div>
            <Link 
              href="/admin"
              className="inline-flex items-center justify-center bg-[#ff7900] hover:bg-[#e06b00] text-white font-bold py-3 px-5 rounded-xl transition-colors w-full text-center"
            >
              Cargar Resultados
            </Link>
          </div>

          {/* Card 3: Documentación */}
          <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-8 hover:border-[#ff7900]/50 transition-all group flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 bg-[#ff7900]/10 border border-[#ff7900]/20 rounded-xl flex items-center justify-center text-[#ff7900] mb-6 group-hover:scale-105 transition-transform">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Widget & Integración</h2>
              <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                Generador de códigos HTML para copiar y pegar en los portales de noticias. Previsualización del carrusel con la paleta de colores de Muove.
              </p>
            </div>
            <Link 
              href="/docs"
              className="inline-flex items-center justify-center bg-[#27272a] hover:bg-zinc-800 text-white font-semibold py-3 px-5 rounded-xl border border-zinc-700 hover:border-zinc-600 transition-colors w-full text-center"
            >
              Ver Integración
            </Link>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#27272a] py-8 text-center text-xs text-zinc-500 bg-[#09090b]">
        <div className="max-w-7xl mx-auto px-4">
          <p>© {new Date().getFullYear()} Muove. Todos los derechos reservados. Diseñado para alto rendimiento y conversión.</p>
        </div>
      </footer>
    </div>
  );
}
