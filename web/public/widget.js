(function () {
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
      return ["client-id", "leagues", "primary-color", "secondary-color", "card-bg-color", "main-text-color", "sub-text-color", "font-family", "border-color-1", "border-color-2"];
    }

    attributeChangedCallback() {
      this.render();
    }

    connectedCallback() {
      this.loadData();
      this.pollingInterval = setInterval(() => {
        this.loadData(true);
      }, 30000);
    }

    disconnectedCallback() {
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
      }
      this.stopAutoplay();
    }

    async loadData(silent = false) {
      const clientId = this.getAttribute("client-id") || "";
      const leagues = this.getAttribute("leagues") || "";

      try {
        const urlParams = new URLSearchParams();
        if (clientId) urlParams.set("client-id", clientId);
        if (leagues) urlParams.set("leagues", leagues);

        const queryString = urlParams.toString();
        const response = await fetch(`${baseUrl}/api/widget${queryString ? `?${queryString}` : ""}`);

        
        if (response.status === 403) {
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
      
      const scrollStep = 316;
      const currentScroll = slider.scrollLeft;
      let targetScroll = currentScroll + (direction === "left" ? -scrollStep : scrollStep);
      
      const maxScrollLeft = slider.scrollWidth - slider.clientWidth;
      targetScroll = Math.max(0, Math.min(maxScrollLeft, targetScroll));

      this.smoothScrollTo(slider, targetScroll, 800);
    }

    startAutoplay() {
      this.stopAutoplay();
      if (this.partidos.length <= 2) return;
      
      this.autoplayInterval = setInterval(() => {
        const slider = this.shadowRoot.getElementById("slider");
        if (!slider) return;
        
        const maxScrollLeft = slider.scrollWidth - slider.clientWidth;
        if (slider.scrollLeft >= maxScrollLeft - 10) {
          this.smoothScrollTo(slider, 0, 1000);
        } else {
          const scrollStep = 316;
          const target = Math.min(maxScrollLeft, slider.scrollLeft + scrollStep);
          this.smoothScrollTo(slider, target, 800);
        }
      }, 3000);
    }

    stopAutoplay() {
      if (this.autoplayInterval) {
        clearInterval(this.autoplayInterval);
        this.autoplayInterval = null;
      }
    }

    formatFechaHora(fechaHoraStr) {
      if (!fechaHoraStr) return "Fecha a confirmar";
      let d = new Date(fechaHoraStr);
      if (isNaN(d.getTime())) {
        d = new Date(String(fechaHoraStr).replace(" ", "T"));
      }
      if (isNaN(d.getTime())) return fechaHoraStr;

      const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
      const diaNombre = dias[d.getDay()];
      const diaNum = String(d.getDate()).padStart(2, "0");
      const mes = String(d.getMonth() + 1).padStart(2, "0");
      const hora = String(d.getHours()).padStart(2, "0");
      const min = String(d.getMinutes()).padStart(2, "0");

      return `${diaNombre}. ${diaNum}/${mes} - ${hora}:${min} hs`;
    }

    render() {
      const sliderBefore = this.shadowRoot.getElementById("slider");
      const savedScrollLeft = sliderBefore ? sliderBefore.scrollLeft : 0;

      const primaryColor = this.estilo.color_primario || this.getAttribute("primary-color") || "#121214";
      const rawSecondary = this.estilo.color_secundario || this.getAttribute("secondary-color") || "#00E676";
      
      let secondaryColor = rawSecondary;
      let cardBgColor = this.estilo.color_fondo_tarjeta || this.getAttribute("card-bg-color") || "#121214";
      let mainTextColor = this.estilo.color_texto_principal || this.getAttribute("main-text-color") || "#f4f4f5";
      let subTextColor = this.estilo.color_texto_secundario || this.getAttribute("sub-text-color") || "#a1a1aa";
      let fuenteFamilia = this.estilo.fuente_familia || this.getAttribute("font-family") || "sans-serif";
      let borderColor1 = this.getAttribute("border-color-1") || this.estilo.color_borde_1 || "#7F35B2";
      let borderColor2 = this.getAttribute("border-color-2") || this.estilo.color_borde_2 || "#EF426F";

      if (rawSecondary.includes("|")) {
        const parts = rawSecondary.split("|");
        secondaryColor = parts[0] || "#00E676";
        cardBgColor = parts[1] || cardBgColor;
        mainTextColor = parts[2] || mainTextColor;
        subTextColor = parts[3] || subTextColor;
        fuenteFamilia = parts[4] || fuenteFamilia;
      }

      let fontFamilyCss = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      if (fuenteFamilia === "serif") {
        fontFamilyCss = "Georgia, Cambria, 'Times New Roman', Times, serif";
      } else if (fuenteFamilia === "montserrat") {
        fontFamilyCss = "'Montserrat', 'Outfit', system-ui, sans-serif";
      } else if (fuenteFamilia === "inter") {
        fontFamilyCss = "'Inter', 'Roboto', system-ui, sans-serif";
      } else if (fuenteFamilia === "poppins") {
        fontFamilyCss = "'Poppins', 'Rubik', system-ui, sans-serif";
      }

      let diarioLogo = this.estilo.logo_medio_url;
      let sponsorUrl = this.estilo.sponsor_url || this.getAttribute("sponsor-url") || "";
      if (diarioLogo && diarioLogo.includes("___CFG___")) {
        const parts = diarioLogo.split("___CFG___");
        diarioLogo = parts[0] || null;
        if (parts[1]) {
          const cfg = parts[1].split("|");
          cardBgColor = cfg[0] || cardBgColor;
          mainTextColor = cfg[1] || mainTextColor;
          subTextColor = cfg[2] || subTextColor;
          fuenteFamilia = cfg[3] || fuenteFamilia;
          borderColor1 = cfg[4] || borderColor1;
          borderColor2 = cfg[5] || borderColor2;
          sponsorUrl = cfg[6] || sponsorUrl;
        }
      }
      const nombreMedio = this.getAttribute("client-name") || "Diario DataNE";
      const clientId = this.getAttribute("client-id") || "";
      const prodeUrl = this.getAttribute("prode-url") || "https://dataene.com.ar/futbol-neco/";

      const styleTemplate = `
        <style>
          @keyframes muove-glow-rotate {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          :host {
            display: flex;
            flex-direction: column;
            width: 100%;
            font-family: ${fontFamilyCss};
            box-sizing: border-box;
            position: relative;
            border-radius: 20px;
            padding: 3.5px;
            background: transparent;
            overflow: hidden;
            box-shadow: none;
          }


          /* Haz de luz de contorno en movimiento independiente personalizado */
          :host::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: conic-gradient(
              from 0deg,
              transparent 0deg,
              transparent 120deg,
              ${borderColor1}40 170deg,
              ${borderColor1} 230deg,
              ${borderColor2} 300deg,
              ${borderColor2} 345deg,
              ${borderColor1} 360deg
            );
            animation: muove-glow-rotate 3.2s linear infinite;
            z-index: 0;
            pointer-events: none;
          }

          /* Resplandor ambiental exterior independiente personalizado */
          :host::after {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: conic-gradient(
              from 0deg,
              transparent 0deg,
              transparent 140deg,
              ${borderColor1}60 190deg,
              ${borderColor1} 250deg,
              ${borderColor2} 315deg,
              ${borderColor1} 360deg
            );
            animation: muove-glow-rotate 3.2s linear infinite;
            filter: blur(12px);
            opacity: 0.9;
            z-index: 0;
            pointer-events: none;
          }



          .widget-inner-box {
            position: relative;
            z-index: 1;
            width: 100%;
            background: #09090b;
            border-radius: 17px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            /* Bisel 3D neomórfico interior */
            box-shadow: inset 0 1.5px 2px rgba(255, 255, 255, 0.15), inset 0 -3px 10px rgba(0, 0, 0, 0.85);
          }

          * { box-sizing: border-box; margin: 0; padding: 0; }
          
          .widget-wrapper {
            display: flex;
            flex-direction: column;
            background: #09090b;
            position: relative;
          }

          .diario-panel {
            width: 100%;
            background: ${primaryColor};
            border-bottom: 1px solid #27272a;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 12px 16px;
            position: relative;
            z-index: 5;
          }
          .diario-panel a.sponsor-link {
            display: flex;
            align-items: center;
            justify-content: center;
            text-decoration: none;
            cursor: pointer;
          }
          .diario-panel img {
            max-width: clamp(200px, 55%, 400px);
            height: clamp(50px, 10vw, 80px);
            object-fit: contain;
            mix-blend-mode: multiply;
          }

          
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
            -ms-overflow-style: none; scrollbar-width: none;
          }
          .slider-container::-webkit-scrollbar { display: none; }

          .match-card {
            background: ${cardBgColor};
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
          .match-card:hover { border-color: ${secondaryColor}50; transform: translateY(-2px); }

          .card-top-bar {
            background: ${secondaryColor};
            color: #000;
            font-size: 9.5px;
            font-weight: 800;
            text-align: center;
            padding: 6px 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-family: ${fontFamilyCss};
          }
          .card-sub-bar {
            background: #09090b;
            border-bottom: 1px solid #1c1c1e;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 12px;
            color: ${subTextColor};
            font-size: 9.5px;
            font-weight: 700;
            font-family: ${fontFamilyCss};
          }
          
          .card-body {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 12px;
            background: ${cardBgColor};
          }
          .team-block {
            display: flex; flex-direction: column; align-items: center; gap: 6px; width: 38%; text-align: center;
          }
          .team-block img {
            width: 38px; height: 38px; object-fit: contain;
            filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.8));
            transition: transform 0.2s ease;
          }
          .team-block:hover img { transform: scale(1.1); }
          .team-name {
            color: ${mainTextColor}; font-size: 10px; font-weight: 700; text-transform: uppercase;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;
            font-family: ${fontFamilyCss};
          }

          .nav-btn {
            position: absolute; top: 0; bottom: 0; width: 30px;
            background: ${secondaryColor}; color: #000; border: none;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; z-index: 10; transition: all 0.2s; outline: none;
          }
          .nav-btn-left { left: 0; }
          .nav-btn-right { right: 0; }
          .nav-btn svg { width: 14px; height: 14px; stroke-width: 3; }

          /* Banner Prode Promocional */
          .prode-promo-bar {
            background: linear-gradient(90deg, #18181b 0%, #09090b 100%);
            border-top: 1px solid #27272a;
            padding: 8px 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .prode-promo-link {
            color: ${secondaryColor};
            font-size: 11px;
            font-weight: 800;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: transform 0.2s;
          }
          .prode-promo-link:hover { transform: translateX(3px); }

          .widget-footer {
            display: flex; justify-content: flex-end; align-items: center;
            padding: 8px 16px; background: #09090b; border-top: 1px solid #1c1c1e;
          }
          .muove-credits { display: flex; align-items: center; gap: 6px; text-decoration: none; opacity: 0.7; }
          .muove-credits span { color: #71717a; font-size: 8px; font-weight: 700; }
          .muove-credits img { height: 9.5px; }

          /* Reglas 100% Responsive para Pantallas Móviles y Celulares (< 640px) */
          @media (max-width: 640px) {
            .slider-container {
              padding: 12px 34px !important;
              gap: 10px !important;
            }
            .match-card {
              min-width: 250px !important;
              width: 82vw !important;
              max-width: 320px !important;
            }
            .prode-promo-bar {
              flex-direction: column !important;
              text-align: center !important;
              gap: 6px !important;
              padding: 10px 12px !important;
            }
            .prode-promo-bar span {
              font-size: 10px !important;
            }
            .prode-promo-link {
              font-size: 10.5px !important;
            }
            .nav-btn {
              width: 26px !important;
            }
            .nav-btn svg {
              width: 12px !important;
              height: 12px !important;
            }
          }
        </style>
      `;

      if (this.loading || this.error || this.partidos.length === 0) {
        this.shadowRoot.innerHTML = `
          ${styleTemplate}
          <div class="widget-inner-box">
            <div class="widget-wrapper">
              <div class="diario-panel">${diarioLogo ? (sponsorUrl ? `<a href="${sponsorUrl}" target="_blank" rel="noopener noreferrer" class="sponsor-link"><img src="${diarioLogo}" /></a>` : `<img src="${diarioLogo}" />`) : `<div style="color:#fff; font-weight:800;">${nombreMedio}</div>`}</div>
              <div style="flex-grow:1; display:flex; align-items:center; justify-content:center; color:#a1a1aa; font-size:12px;">
                ${this.loading ? "Cargando marcadores..." : this.error || "No hay partidos hoy."}
              </div>
            </div>
          </div>
        `;
        return;
      }

      const resolveLogoUrl = (logoUrl) => {
        if (!logoUrl) return "https://placehold.co/40/121214/fff?text=EQ";
        if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) {
          return logoUrl;
        }
        return `${baseUrl}${logoUrl.startsWith("/") ? "" : "/"}${logoUrl}`;
      };

      const cardsHtml = this.partidos.map(p => {
        const esLive = p.estado_partido === "en_vivo";
        const esFinalizado = p.estado_partido === "finalizado";
        const esSuspendido = p.estado_partido === "suspendido";
        const esDemorado = p.estado_partido === "demorado" || p.estado_partido === "postergado";
        const fechaHoraText = this.formatFechaHora(p.fecha_hora);

        let subBarStatus = `📅 ${fechaHoraText}`;
        if (esLive) {
          subBarStatus = `<span style="color:#22c55e; font-weight:bold;">● EN VIVO</span>`;
        } else if (esFinalizado) {
          subBarStatus = "FINALIZADO";
        } else if (esSuspendido) {
          subBarStatus = `<span style="color:#ef4444; font-weight:900; background:rgba(239,68,68,0.2); padding:2px 6px; border-radius:4px;">🛑 SUSPENDIDO</span>`;
        } else if (esDemorado) {
          subBarStatus = `<span style="color:#f59e0b; font-weight:900; background:rgba(245,158,11,0.2); padding:2px 6px; border-radius:4px;">⚠️ DEMORADO</span>`;
        }

        let scoreDisplay = "VS";
        if (esLive || esFinalizado) {
          scoreDisplay = `${p.goles_local} - ${p.goles_visitante}`;
        } else if (esSuspendido || esDemorado) {
          if (p.goles_local > 0 || p.goles_visitante > 0) {
            scoreDisplay = `${p.goles_local} - ${p.goles_visitante}`;
          } else {
            scoreDisplay = "VS";
          }
        }

        return `
          <div class="match-card">
            <div class="card-top-bar">${p.liga_nombre}</div>
            <div class="card-sub-bar">
              <span>${subBarStatus}</span>
              ${p.jornada ? `<span style="color:#d4d4d8; font-weight:700;">${p.jornada}</span>` : ""}
            </div>
            <div class="card-body">
              <div class="team-block">
                <img src="${resolveLogoUrl(p.equipo_local.logo)}" alt="" />
                <span class="team-name">${p.equipo_local.nombre}</span>
              </div>
              <div style="color:${mainTextColor}; font-size:16px; font-weight:900; font-family:${fontFamilyCss};">
                ${scoreDisplay}
              </div>
              <div class="team-block">
                <img src="${resolveLogoUrl(p.equipo_visitante.logo)}" alt="" />
                <span class="team-name">${p.equipo_visitante.nombre}</span>
              </div>
            </div>
          </div>
        `;
      }).join("");

      this.shadowRoot.innerHTML = `
        ${styleTemplate}
        <div class="widget-inner-box">
          <div class="widget-wrapper">
            <div class="diario-panel">
              ${diarioLogo ? (sponsorUrl ? `<a href="${sponsorUrl}" target="_blank" rel="noopener noreferrer" class="sponsor-link"><img src="${diarioLogo}" /></a>` : `<img src="${diarioLogo}" />`) : `<div style="color:#fff; font-weight:800; font-size:16px;">${nombreMedio}</div>`}
            </div>

            <div class="slider-wrapper">
              ${this.partidos.length > 2 ? `<button class="nav-btn nav-btn-left" id="btn-left"><svg viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" stroke="currentColor" /></svg></button>` : ""}
              <div class="slider-container" id="slider">${cardsHtml}</div>
              ${this.partidos.length > 2 ? `<button class="nav-btn nav-btn-right" id="btn-right"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" stroke="currentColor" /></svg></button>` : ""}
            </div>
          </div>

          <!-- Banner Promocional al Prode Completo (Exclusivo DataeNe o si está activado) -->
          ${this.estilo.mostrar_prode ? `
            <div class="prode-promo-bar">
              <span style="color:#a1a1aa; font-size:11px; font-weight:700;">¿Quién gana esta fecha?</span>
              <a href="${prodeUrl}" target="_top" class="prode-promo-link">
                ¡Jugá al Prode de tu equipo y ganá! ➔
              </a>
            </div>
          ` : ""}

          <div class="widget-footer">
            <a href="https://agenciamuove.com/" target="_blank" rel="noopener noreferrer" class="muove-credits">
              <span>Creado por</span>
              <img src="${baseUrl}/logo_muove.svg" alt="Muove" />
            </a>
          </div>
        </div>
      `;


      const sliderAfter = this.shadowRoot.getElementById("slider");
      if (sliderAfter) sliderAfter.scrollLeft = savedScrollLeft;

      const btnLeft = this.shadowRoot.getElementById("btn-left");
      const btnRight = this.shadowRoot.getElementById("btn-right");
      if (btnLeft) btnLeft.addEventListener("click", () => this.scroll("left"));
      if (btnRight) btnRight.addEventListener("click", () => this.scroll("right"));

      this.startAutoplay();
    }
  }

  if (!customElements.get("futbol-widget")) {
    customElements.define("futbol-widget", FutbolWidget);
  }
})();
