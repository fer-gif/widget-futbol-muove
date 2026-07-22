(function () {
  // Obtener la URL base del script para saber a qué servidor Next.js llamar
  const scriptSrc = document.currentScript ? document.currentScript.src : "https://widget-futbol-muove.vercel.app/widget.js";
  const baseUrl = new URL(scriptSrc).origin;

  class FutbolWidget extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.partidos = [];
      this.estilo = {};
      this.loading = true;
      this.error = null;
      this.scrollAmount = 0;
      this.autoplayInterval = null;
    }

    static get observedAttributes() {
      return ["client-id", "leagues"];
    }

    attributeChangedCallback() {
      this.loadData();
    }

    connectedCallback() {
      this.loadData();
      // Intervalo de actualización en vivo (cada 30 segundos)
      this.pollingInterval = setInterval(() => {
        this.loadData(true); // Cargar de fondo de forma silenciosa
      }, 30000);
    }

    disconnectedCallback() {
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
      }
      this.stopAutoplay();
    }

    async loadData(silent = false) {
      const clientId = this.getAttribute("client-id");
      const leagues = this.getAttribute("leagues") || "";

      if (!clientId) {
        this.error = "Falta el atributo client-id en el widget.";
        this.loading = false;
        this.render();
        return;
      }

      try {
        const response = await fetch(`${baseUrl}/api/widget?client-id=${clientId}&leagues=${leagues}`);
        
        if (response.status === 403) {
          // Suscripción suspendida
          const res = await response.json();
          this.error = res.message || "Suscripción suspendida.";
          this.loading = false;
          this.render();
          return;
        }

        if (!response.ok) {
          throw new Error("Error al obtener los datos deportivos.");
        }

        const data = await response.json();
        this.partidos = data.partidos || [];
        this.estilo = data.estilo || {};
        this.error = null;
      } catch (err) {
        console.error("Widget Error:", err);
        if (!silent) {
          this.error = "No se pudieron cargar los marcadores.";
        }
      } finally {
        this.loading = false;
        this.render();
      }
    }

    smoothScrollTo(element, target, duration = 800) {
      const start = element.scrollLeft;
      const change = target - start;
      const startTime = performance.now();

      const animateScroll = (timestamp) => {
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing: easeInOutQuad (aceleración y desaceleración suaves)
        const ease = progress < 0.5 
          ? 2 * progress * progress 
          : -1 + (4 - 2 * progress) * progress;

        element.scrollLeft = start + change * ease;

        if (progress < 1) {
          requestAnimationFrame(animateScroll);
        }
      };

      requestAnimationFrame(animateScroll);
    }

    scroll(direction) {
      const slider = this.shadowRoot.getElementById("slider");
      if (!slider) return;
      
      const scrollStep = 316; // Tarjeta (300px) + gap (16px)
      const currentScroll = slider.scrollLeft;
      let targetScroll = currentScroll + (direction === "left" ? -scrollStep : scrollStep);
      
      const maxScrollLeft = slider.scrollWidth - slider.clientWidth;
      targetScroll = Math.max(0, Math.min(maxScrollLeft, targetScroll));

      this.smoothScrollTo(slider, targetScroll, 800); // 800ms de transición fluida
    }

    startAutoplay() {
      this.stopAutoplay();
      if (this.partidos.length <= 2) return; // No autoplay needed if all fit on screen
      
      this.autoplayInterval = setInterval(() => {
        const slider = this.shadowRoot.getElementById("slider");
        if (!slider) return;
        
        const maxScrollLeft = slider.scrollWidth - slider.clientWidth;
        if (slider.scrollLeft >= maxScrollLeft - 10) {
          this.smoothScrollTo(slider, 0, 1000); // Retorno lento al inicio (1 segundo)
        } else {
          const scrollStep = 316;
          const target = Math.min(maxScrollLeft, slider.scrollLeft + scrollStep);
          this.smoothScrollTo(slider, target, 800); // Transición de 800ms
        }
      }, 3000); // Cada 3 segundos
    }

    stopAutoplay() {
      if (this.autoplayInterval) {
        clearInterval(this.autoplayInterval);
        this.autoplayInterval = null;
      }
    }

    resetAutoplayTimer() {
      this.stopAutoplay();
      this.startAutoplay();
    }

    render() {
      // Guardar posición de scroll antes de renderizar
      const sliderBefore = this.shadowRoot.getElementById("slider");
      const savedScrollLeft = sliderBefore ? sliderBefore.scrollLeft : 0;

      // Definir colores basados en la respuesta de la base de datos o por defecto
      const primaryColor = this.estilo.color_primario || "#121214";
      const secondaryColor = this.estilo.color_secundario || "#00E676";
      const sponsorLogo = this.estilo.logo_medio_url;
      const nombreMedio = this.getAttribute("client-name") || "MUOVE";

      // Template de Estilos encapsulado (Shadow DOM)
      const styleTemplate = `
        <style>
          :host {
            display: flex;
            flex-direction: column;
            width: 100%;
            font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            box-sizing: border-box;
            background: #09090b;
            border-radius: 16px;
            overflow: hidden;
            border: 1px solid #27272a;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          
          /* Contenedor Principal */
          .widget-wrapper {
            display: flex;
            align-items: stretch;
            background: #09090b;
            min-height: 155px;
            position: relative;
          }

          /* Panel Izquierdo de Sponsor */
          .sponsor-panel {
            width: 130px;
            background: ${primaryColor};
            border-right: 1px solid #27272a;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            text-align: center;
            flex-shrink: 0;
            position: relative;
            z-index: 5;
          }
          .sponsor-panel img {
            max-width: 100%;
            max-height: 75px;
            object-fit: contain;
            filter: drop-shadow(0 2px 8px rgba(0,0,0,0.5));
          }
          .sponsor-text {
            color: #fff;
            font-weight: 800;
            font-size: 20px;
            letter-spacing: 0.5px;
          }
          
          /* Footer de Créditos */
          .widget-footer {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            padding: 8px 16px 8px 16px;
            background: #09090b;
            border-top: 1px solid #1c1c1e;
          }
          .muove-credits {
            display: flex;
            align-items: center;
            gap: 6px;
            text-decoration: none;
            opacity: 0.65;
            transition: opacity 0.2s ease;
          }
          .muove-credits:hover {
            opacity: 1;
          }
          .muove-credits span {
            color: #71717a;
            font-size: 7.5px;
            font-weight: 750;
            text-transform: uppercase;
            letter-spacing: 0.8px;
          }
          .muove-credits img {
            height: 9.5px;
            width: auto;
          }

          /* Carrusel de partidos */
          .slider-wrapper {
            flex-grow: 1;
            position: relative;
            overflow: hidden;
            display: flex;
            align-items: center;
          }
          
          .slider-container {
            display: flex;
            gap: 16px;
            overflow-x: auto;
            padding: 16px 40px;
            width: 100%;
            height: 100%;
            align-items: center;
          }
          
          /* Ocultar barra de scroll */
          .slider-container::-webkit-scrollbar {
            display: none;
          }
          .slider-container {
            -ms-overflow-style: none;  /* IE and Edge */
            scrollbar-width: none;  /* Firefox */
          }

          /* Tarjetas individuales de Partidos */
          .match-card {
            background: #121214;
            border: 1px solid #27272a;
            border-radius: 12px;
            min-width: 300px;
            width: 300px;
            flex-shrink: 0;
            transition: all 0.2s ease-in-out;
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          .match-card:hover {
            border-color: ${secondaryColor}50;
            transform: translateY(-2px);
          }

          /* Cabecera Liga con color secundario */
          .card-top-bar {
            background: ${secondaryColor};
            color: #000;
            font-size: 9.5px;
            font-weight: 800;
            text-align: center;
            padding: 6px 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 1px;
          }
          .card-top-bar .league-name {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            width: 100%;
          }

          /* Sub-header oscuro */
          .card-sub-bar {
            background: #09090b;
            border-bottom: 1px solid #1c1c1e;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 12px;
            color: #71717a;
            font-size: 9px;
            font-weight: 700;
            letter-spacing: 0.5px;
          }
          
          /* Estado "En Vivo" */
          .live-badge {
            background: rgba(34, 197, 94, 0.1);
            color: #22c55e;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 9px;
            font-weight: 850;
            letter-spacing: 0.5px;
            border: 1px solid rgba(34, 197, 94, 0.3);
            animation: pulse 1.5s infinite;
          }
          @keyframes pulse {
            0% { opacity: 0.7; }
            50% { opacity: 1; }
            100% { opacity: 0.7; }
          }
          


          /* Cuerpo del partido (Horizontal) */
          .card-body {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 12px;
            flex-grow: 1;
            background: #121214;
          }

          .team-block {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            width: 38%;
            text-align: center;
          }
          .team-block img {
            width: 32px;
            height: 32px;
            object-fit: contain;
          }
          .team-name {
            color: #f4f4f5;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            width: 100%;
          }

          .score-block {
            width: 24%;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .vs-text {
            color: #71717a;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 1px;
          }
          .score-display {
            display: flex;
            align-items: center;
            gap: 6px;
            color: #fff;
            font-size: 18px;
            font-weight: 900;
          }
          .score-num {
            background: #1c1c1e;
            border: 1px solid #27272a;
            padding: 2px 8px;
            border-radius: 6px;
            min-width: 24px;
            text-align: center;
          }
          .score-num.live {
            color: #22c55e;
            border-color: rgba(34, 197, 94, 0.3);
          }
          .score-divider {
            color: #52525b;
            font-weight: 500;
          }


          
          /* Flechas de Navegación (Barras verticales completas) */
          .nav-btn {
            position: absolute;
            top: 0;
            bottom: 0;
            width: 30px;
            background: ${secondaryColor};
            color: #000;
            border: none;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 10;
            transition: all 0.2s;
            outline: none;
          }
          .nav-btn:hover {
            filter: brightness(1.1);
          }
          .nav-btn:active {
            filter: brightness(0.9);
          }
          .nav-btn-left {
            left: 0;
          }
          .nav-btn-right {
            right: 0;
          }
          .nav-btn svg {
            width: 14px;
            height: 14px;
            fill: none;
            stroke: #000;
            stroke-width: 3.5;
          }

          /* Estados de carga o error */
          .center-msg {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 30px;
            color: #71717a;
            font-size: 12px;
            font-weight: 600;
            width: 100%;
          }

          /* Responsividad para móviles y pantallas angostas */
          @media (max-width: 640px) {
            .widget-wrapper {
              flex-direction: column;
              min-height: auto;
            }
            .sponsor-panel {
              width: 100%;
              height: 60px;
              min-height: 60px;
              border-right: none;
              border-bottom: 1px solid #27272a;
              padding: 8px 16px;
              display: flex;
              flex-direction: row;
              justify-content: center;
              align-items: center;
            }
            .sponsor-panel img {
              max-height: 40px;
            }
            .sponsor-text {
              font-size: 16px;
            }
            .slider-container {
              padding: 12px 28px;
              gap: 12px;
            }
            .match-card {
              min-width: 250px;
              width: 250px;
              border-radius: 8px;
            }
            .card-top-bar {
              font-size: 9px;
              padding: 4px 8px;
            }
            .card-sub-bar {
              padding: 4px 8px;
            }
            .card-body {
              padding: 12px 8px;
            }
            .team-block img {
              width: 24px;
              height: 24px;
            }
            .team-name {
              font-size: 9px;
            }
            .score-display {
              font-size: 15px;
            }
            .score-num {
              padding: 1px 6px;
              min-width: 20px;
            }
            .vs-text {
              font-size: 10px;
            }
            .nav-btn {
              width: 20px;
            }
            .nav-btn svg {
              width: 8px;
              height: 8px;
              stroke-width: 4;
            }
            .widget-footer {
              padding: 6px 12px;
              justify-content: center;
            }
            .muove-credits span {
              font-size: 7px;
            }
            .muove-credits img {
              height: 8.5px;
            }
          }
        </style>
      `;

      // Renderizar estado de carga
      if (this.loading) {
        this.shadowRoot.innerHTML = `
          ${styleTemplate}
          <div class="widget-wrapper">
            <div class="center-msg">Cargando marcadores en vivo...</div>
          </div>
        `;
        return;
      }

      // Renderizar estado de error
      if (this.error) {
        this.shadowRoot.innerHTML = `
          ${styleTemplate}
          <div class="widget-wrapper">
            <div class="center-msg" style="color: #ef4444;">${this.error}</div>
          </div>
        `;
        return;
      }

      // Renderizar estado sin partidos cargados
      if (this.partidos.length === 0) {
        this.shadowRoot.innerHTML = `
          ${styleTemplate}
          <div class="widget-wrapper">
            <div class="sponsor-panel">
              ${sponsorLogo ? `<img src="${sponsorLogo}" alt="" />` : `<div class="sponsor-text">${nombreMedio}</div>`}
            </div>
            <div class="center-msg">No hay partidos programados para hoy.</div>
          </div>
          <div class="widget-footer">
            <a href="https://agenciamuove.com/" target="_blank" rel="noopener noreferrer" class="muove-credits">
              <span>Creado por</span>
              <img src="${baseUrl}/logo_muove.svg" alt="Muove" />
            </a>
          </div>
        `;
        return;
      }

      // Construcción del fixture HTML
      const cardsHtml = this.partidos.map(p => {
        const esLive = p.estado_partido === "en_vivo";
        const esFinalizado = p.estado_partido === "finalizado";
        const esDemorado = p.estado_partido === "demorado";
        const esSuspendido = p.estado_partido === "suspendido";
        
        let dateText = "A confirmar";
        if (p.fecha_hora) {
          const date = new Date(p.fecha_hora);
          if (!isNaN(date.getTime())) {
            dateText = `${date.toLocaleDateString("es-AR", { day: '2-digit', month: '2-digit' })} ${date.toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' })} hs`;
          }
        }

        let statusBadge = "";
        if (esLive) {
          const suffix = typeof p.minuto_actual === "number" || (!isNaN(p.minuto_actual) && !isNaN(parseFloat(p.minuto_actual))) ? "'" : "";
          statusBadge = `<span class="live-badge">VIVO - ${p.minuto_actual}${suffix}</span>`;
        } else if (esFinalizado) {
          statusBadge = `<span class="finished-tag" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; text-transform: uppercase;">Finalizado</span>`;
        } else if (esDemorado) {
          statusBadge = `<span class="demorado-badge" style="background: rgba(234, 179, 8, 0.1); color: #eab308; border: 1px solid rgba(234, 179, 8, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; text-transform: uppercase; animation: pulse 2s infinite;">Demorado</span>`;
        } else if (esSuspendido) {
          statusBadge = `<span class="suspendido-badge" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; text-transform: uppercase;">Suspendido</span>`;
        } else {
          statusBadge = `<span class="programado-badge" style="background: rgba(113, 113, 122, 0.1); color: #a1a1aa; border: 1px solid rgba(113, 113, 122, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; text-transform: uppercase;">Programado</span>`;
        }

        const showGoals = p.estado_partido !== "programado" || esLive;

        return `
          <div class="match-card">
            <!-- Header con color de acento -->
            <div class="card-top-bar">
              <span class="league-name">${p.liga_nombre}</span>
              ${p.jornada ? `<span style="font-size: 7.5px; font-weight: 700; opacity: 0.85; letter-spacing: 0.5px;">${p.jornada}</span>` : ""}
            </div>
            
            <!-- Sub-header oscuro -->
            <div class="card-sub-bar">
              <span>${statusBadge}</span>
              <span style="color: #71717a; font-size: 9px; font-weight: 700; letter-spacing: 0.3px;">${dateText}</span>
            </div>

            <!-- Cuerpo del partido (Horizontal) -->
            <div class="card-body">
              <!-- Local -->
              <div class="team-block">
                <img src="${p.equipo_local.logo || "https://placehold.co/40/121214/fff?text=L"}" alt="" />
                <span class="team-name">${p.equipo_local.nombre}</span>
              </div>
              
              <!-- Centro (Score o VS) -->
              <div class="score-block">
                ${showGoals 
                  ? `<div class="score-display">
                       <span class="score-num ${esLive ? "live" : ""}">${p.goles_local}</span>
                       <span class="score-divider">-</span>
                       <span class="score-num ${esLive ? "live" : ""}">${p.goles_visitante}</span>
                     </div>`
                  : `<span class="vs-text">VS</span>`
                }
              </div>
              
              <!-- Visitante -->
              <div class="team-block">
                <img src="${p.equipo_visitante.logo || "https://placehold.co/40/121214/fff?text=V"}" alt="" />
                <span class="team-name">${p.equipo_visitante.nombre}</span>
              </div>
            </div>

          </div>
        `;
      }).join("");

      // Estructura completa del HTML
      this.shadowRoot.innerHTML = `
        ${styleTemplate}
        <div class="widget-wrapper">
          
          <!-- Bloque de Branding Izquierdo -->
          <div class="sponsor-panel">
            ${sponsorLogo ? `<img src="${sponsorLogo}" alt="Branding" />` : `<div class="sponsor-text">${nombreMedio}</div>`}
          </div>

          <!-- Carrusel Deslizable -->
          <div class="slider-wrapper">
            
            ${this.partidos.length > 2 ? `
              <button class="nav-btn nav-btn-left" id="btn-left">
                <svg viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" stroke="currentColor" /></svg>
              </button>
            ` : ""}

            <div class="slider-container" id="slider">
              ${cardsHtml}
            </div>

            ${this.partidos.length > 2 ? `
              <button class="nav-btn nav-btn-right" id="btn-right">
                <svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" stroke="currentColor" /></svg>
              </button>
            ` : ""}

          </div>
        </div>
        <div class="widget-footer">
          <a href="https://agenciamuove.com/" target="_blank" rel="noopener noreferrer" class="muove-credits">
            <span>Creado por</span>
            <img src="${baseUrl}/logo_muove.svg" alt="Muove" />
          </a>
        </div>
      `;

      // Restaurar posición de scroll guardada
      const sliderAfter = this.shadowRoot.getElementById("slider");
      if (sliderAfter) {
        sliderAfter.scrollLeft = savedScrollLeft;
      }

      // Registrar eventos de las flechas si existen
      const btnLeft = this.shadowRoot.getElementById("btn-left");
      const btnRight = this.shadowRoot.getElementById("btn-right");

      if (btnLeft) btnLeft.addEventListener("click", () => {
        this.scroll("left");
        this.resetAutoplayTimer();
      });
      if (btnRight) btnRight.addEventListener("click", () => {
        this.scroll("right");
        this.resetAutoplayTimer();
      });

      // Eventos hover para pausar y reanudar autoplay
      const wrapper = this.shadowRoot.querySelector(".widget-wrapper");
      if (wrapper) {
        wrapper.addEventListener("mouseenter", () => this.stopAutoplay());
        wrapper.addEventListener("mouseleave", () => this.startAutoplay());
      }

      // Iniciar el autoplay
      this.startAutoplay();
    }
  }

  // Definir el Custom Element global en el navegador
  if (!customElements.get("futbol-widget")) {
    customElements.define("futbol-widget", FutbolWidget);
  }
})();
