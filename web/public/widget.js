/*!
 * Muove · Widget de Fútbol  <futbol-widget client-id="...">
 *
 * Atributos opcionales: leagues, client-name, theme (oscuro|claro|auto),
 * tabs ("partidos,posiciones,goleadores"), sponsor-url, prode-url y los colores
 * primary-color, secondary-color, card-bg-color, main-text-color,
 * sub-text-color, border-color-1, border-color-2, font-family.
 * La configuración guardada en el super-admin tiene prioridad sobre los colores.
 */
(function () {
  "use strict";

  var scriptSrc = document.currentScript
    ? document.currentScript.src
    : "https://widget-futbol-muove.vercel.app/widget.js";
  var baseUrl = new URL(scriptSrc).origin;
  var TZ = "America/Argentina/Buenos_Aires";

  var POLL_LIVE_MS = 20000; // con partidos en vivo
  var POLL_IDLE_MS = 60000; // sin partidos en vivo
  var TICK_MS = 15000; // avance local del minuto
  var AUTOPLAY_MS = 4500;
  var AUTOPLAY_RESUME_MS = 6000;
  var LIVE_WINDOW_MIN = 130; // igual que src/lib/match-clock.ts

  // ---------------------------------------------------------------------------
  // Seguridad: todo dato externo se escapa / valida antes de ir al HTML o al CSS
  // ---------------------------------------------------------------------------
  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /** Crédito a la fuente de las tablas (solo fuentes conocidas). */
  function sourceNote(fuente) {
    if (fuente !== "ahorafutbol.ar") return "";
    return '<p class="source">Datos: <a href="https://www.ahorafutbol.ar/" target="_blank" rel="noopener noreferrer">ahorafutbol.ar</a></p>';
  }

  function safeUrl(value) {
    if (!value) return "";
    try {
      var u = new URL(String(value), baseUrl);
      return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : "";
    } catch (e) {
      return "";
    }
  }

  var HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
  function safeColor(value, fallback) {
    return typeof value === "string" && HEX.test(value.trim()) ? value.trim() : fallback;
  }

  function hexToRgb(hex) {
    var h = hex.replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function withAlpha(hex, alpha) {
    var c = hexToRgb(hex);
    return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + alpha + ")";
  }

  /** Color de texto legible (negro o blanco) sobre un fondo dado. */
  function inkFor(hex) {
    var c = hexToRgb(hex).map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    var lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    return lum > 0.4 ? "#0b0b0d" : "#ffffff";
  }

  // ---------------------------------------------------------------------------
  // Fechas (siempre en hora argentina, sin importar dónde esté el lector)
  // ---------------------------------------------------------------------------
  var fmtCache = {};
  function parts(date, opts) {
    var key = JSON.stringify(opts);
    if (!fmtCache[key]) {
      fmtCache[key] = new Intl.DateTimeFormat("es-AR", Object.assign({ timeZone: TZ }, opts));
    }
    var out = {};
    fmtCache[key].formatToParts(date).forEach(function (p) {
      out[p.type] = p.value;
    });
    return out;
  }

  function toDate(value) {
    if (!value) return null;
    var d = new Date(value);
    if (isNaN(d.getTime())) d = new Date(String(value).replace(" ", "T"));
    return isNaN(d.getTime()) ? null : d;
  }

  function dayKey(date) {
    var p = parts(date, { year: "numeric", month: "2-digit", day: "2-digit" });
    return p.year + "-" + p.month + "-" + p.day;
  }

  function fmtDay(date, now) {
    var k = dayKey(date);
    if (k === dayKey(new Date(now))) return "Hoy";
    if (k === dayKey(new Date(now + 864e5))) return "Mañana";
    if (k === dayKey(new Date(now - 864e5))) return "Ayer";
    var p = parts(date, { weekday: "short", day: "2-digit", month: "2-digit" });
    var wd = (p.weekday || "").replace(".", "");
    return wd.charAt(0).toUpperCase() + wd.slice(1) + " " + p.day + "/" + p.month;
  }

  function fmtTime(date) {
    var p = parts(date, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    return p.hour + ":" + p.minute;
  }

  // ---------------------------------------------------------------------------
  // Minuto en vivo (copia de la lógica de src/lib/match-clock.ts)
  // ---------------------------------------------------------------------------
  function liveMinute(p, now) {
    if (p.estado_partido !== "en_vivo") return null;
    var r = p.reloj;
    if (r && r.periodo === "ET") return "ET";
    var inicio = r && r.inicio ? new Date(r.inicio).getTime() : NaN;
    if (r && (r.periodo === "1T" || r.periodo === "2T") && !isNaN(inicio)) {
      var base = r.periodo === "1T" ? 0 : 45;
      var total = base + Math.max(1, Math.floor((now - inicio) / 60000) + 1);
      return total > base + 45 ? base + 45 + "+" : total + "'";
    }
    var start = p.fecha_hora ? new Date(p.fecha_hora).getTime() : NaN;
    if (p.minuto_estimado && !isNaN(start) && now >= start) {
      var diff = Math.floor((now - start) / 60000);
      if (diff > LIVE_WINDOW_MIN) return p.minuto || null;
      return diff < 45 ? diff + 1 + "'" : diff < 60 ? "ET" : diff < 105 ? diff - 14 + "'" : "90+";
    }
    return p.minuto || null;
  }

  function minuteLabel(min) {
    return min === "ET" ? "Entretiempo" : min || "";
  }

  // ---------------------------------------------------------------------------
  var FONT_STACKS = {
    "sans-serif": 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    serif: "Georgia, Cambria, 'Times New Roman', Times, serif",
    montserrat: "'Montserrat', 'Outfit', system-ui, sans-serif",
    inter: "'Inter', 'Roboto', system-ui, sans-serif",
    poppins: "'Poppins', 'Rubik', system-ui, sans-serif",
  };

  var ICON_PREV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 19l-7-7 7-7"/></svg>';
  var ICON_NEXT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  var PLACEHOLDER_LOGO =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path d="M20 3l14 5v11c0 9-6 15-14 18C12 34 6 28 6 19V8z" fill="#3f3f46"/></svg>'
    );

  var TAB_LABELS = { partidos: "Partidos", posiciones: "Posiciones", goleadores: "Goleadores" };
  var FILTER_LABELS = { hoy: "Hoy", proximos: "Próximos", resultados: "Resultados" };

  function isLive(p) {
    return p.estado_partido === "en_vivo";
  }

  // ===========================================================================
  class FutbolWidget extends HTMLElement {
    static get observedAttributes() {
      return [
        "client-id", "leagues", "client-name", "theme", "tabs", "sponsor-url", "prode-url", "logo-url",
        "primary-color", "secondary-color", "card-bg-color", "main-text-color", "sub-text-color",
        "font-family", "border-color-1", "border-color-2",
      ];
    }

    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.state = {
        loading: true,
        error: null,
        partidos: [],
        estilo: {},
        nombreMedio: "",
        tab: "partidos",
        filtro: null,
        zona: "A",
        standings: null, // null = sin pedir, "loading", objeto, o { error }
        scorers: null,
      };
      this.serverOffset = 0;
      this.prevScores = new Map();
      this.pauseUntil = 0;
      this.hovering = false;
      this.reduceMotion = window.matchMedia
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : { matches: false };
      this.onVisibility = this.onVisibility.bind(this);
      this.onShadowClick = this.onShadowClick.bind(this);
      // Un solo listener delegado: el contenido interno se redibuja, el shadowRoot no.
      this.shadowRoot.addEventListener("click", this.onShadowClick);
      this.mounted = false;
    }

    connectedCallback() {
      if (this.mounted) return;
      this.mounted = true;
      this.renderShell();
      this.load();
      document.addEventListener("visibilitychange", this.onVisibility);
      this.tickTimer = setInterval(this.tickMinutes.bind(this), TICK_MS);
      this.autoplayTimer = setInterval(this.autoplayStep.bind(this), AUTOPLAY_MS);
    }

    disconnectedCallback() {
      document.removeEventListener("visibilitychange", this.onVisibility);
      clearTimeout(this.pollTimer);
      clearInterval(this.tickTimer);
      clearInterval(this.autoplayTimer);
      if (this.impressionObserver) this.impressionObserver.disconnect();
      this.impressionObserver = null;
      this.mounted = false;
    }

    attributeChangedCallback(name, oldValue, newValue) {
      // Los atributos iniciales llegan antes de connectedCallback: los ignora porque ahí se carga todo.
      if (!this.mounted || oldValue === newValue) return;
      if (name === "client-id" || name === "leagues") {
        this.prevScores.clear();
        this.state.loading = true;
        this.load();
        return;
      }
      this.renderShell();
      this.renderContent();
    }

    now() {
      return Date.now() + this.serverOffset;
    }

    // -------------------------------------------------------------------------
    // Datos
    // -------------------------------------------------------------------------
    async load(silent) {
      clearTimeout(this.pollTimer);
      var params = new URLSearchParams();
      var clientId = this.getAttribute("client-id");
      var leagues = this.getAttribute("leagues");
      if (clientId) params.set("client-id", clientId);
      if (leagues) params.set("leagues", leagues);
      var qs = params.toString();

      try {
        var res = await fetch(baseUrl + "/api/widget" + (qs ? "?" + qs : ""));
        var data = await res.json().catch(function () {
          return null;
        });
        if (!res.ok || !data || !data.success) {
          var msg = (data && data.message) || "No se pudieron cargar los partidos.";
          throw Object.assign(new Error(msg), { fatal: res.status === 403 || res.status === 404 });
        }

        if (data.server_time) this.serverOffset = data.server_time - Date.now();

        var goals = this.detectGoals(data.partidos || []);
        var estiloChanged = JSON.stringify(data.estilo || {}) !== JSON.stringify(this.state.estilo);
        var wasLoading = this.state.loading;

        this.state.partidos = data.partidos || [];
        this.state.estilo = data.estilo || {};
        this.state.nombreMedio = data.nombre_medio || "";
        this.clienteId = data.cliente_id || null;
        this.state.loading = false;
        this.state.error = null;

        if (estiloChanged || wasLoading) this.renderShell();
        this.renderContent(goals);
        this.observeImpression();
      } catch (err) {
        console.error("[futbol-widget]", err);
        // En una actualización silenciosa se conservan los datos anteriores.
        if (!silent || this.state.partidos.length === 0 || err.fatal) {
          this.state.loading = false;
          this.state.error = err.message || "No se pudieron cargar los partidos.";
          if (err.fatal) this.state.partidos = [];
          this.renderContent();
        }
        if (err.fatal) return; // cliente inactivo o inexistente: no seguir consultando
      }
      this.scheduleNextPoll();
    }

    scheduleNextPoll() {
      clearTimeout(this.pollTimer);
      if (document.hidden) return;
      var delay = this.state.partidos.some(isLive) ? POLL_LIVE_MS : POLL_IDLE_MS;
      this.pollTimer = setTimeout(this.load.bind(this, true), delay);
    }

    onVisibility() {
      if (document.hidden) clearTimeout(this.pollTimer);
      else this.load(true);
    }

    /** Compara con la consulta anterior y devuelve los partidos con gol nuevo. */
    detectGoals(partidos) {
      var goals = new Map();
      var first = this.prevScores.size === 0;
      var self = this;
      partidos.forEach(function (p) {
        var prev = self.prevScores.get(p.id);
        var l = Number(p.goles_local) || 0;
        var v = Number(p.goles_visitante) || 0;
        if (!first && prev) {
          if (l > prev.l) goals.set(p.id, "local");
          else if (v > prev.v) goals.set(p.id, "visitante");
        }
        self.prevScores.set(p.id, { l: l, v: v });
      });
      return goals;
    }

    async loadExtra(kind) {
      var key = kind === "posiciones" ? "standings" : "scorers";
      if (this.state[key] && this.state[key] !== "loading" && !this.state[key].error) return;
      this.state[key] = "loading";
      this.renderContent();
      try {
        var url = kind === "posiciones" ? "/api/prode/standings" : "/api/goleadores";
        var res = await fetch(baseUrl + url);
        var data = await res.json();
        if (!res.ok || !data.success) throw new Error("sin datos");
        this.state[key] =
          kind === "posiciones"
            ? { nombre: data.ligaNombre || "", A: data.zonaA || [], B: data.zonaB || [], fuente: data.fuente || "" }
            : { lista: data.goleadores || [], fuente: data.fuente || "" };
      } catch (e) {
        this.state[key] = { error: true };
      }
      this.renderContent();
    }

    // -------------------------------------------------------------------------
    // Métricas (impresiones y clics). No se registra en la vista previa del admin.
    // -------------------------------------------------------------------------
    track(evento) {
      if (!this.clienteId || this.hasAttribute("preview")) return;
      this.tracked = this.tracked || {};
      // Impresión e interacción: una vez por visita. Los clics se cuentan todos.
      if ((evento === "impresion" || evento === "interaccion") && this.tracked[evento]) return;
      this.tracked[evento] = true;
      var body = JSON.stringify({ c: this.clienteId, e: evento });
      try {
        if (navigator.sendBeacon && navigator.sendBeacon(baseUrl + "/api/track", body)) return;
      } catch (err) {}
      fetch(baseUrl + "/api/track", { method: "POST", body: body, keepalive: true }).catch(function () {});
    }

    /** Cuenta la impresión cuando al menos la mitad del widget está en pantalla. */
    observeImpression() {
      if (this.impressionObserver || (this.tracked && this.tracked.impresion)) return;
      var self = this;
      if (!("IntersectionObserver" in window)) return this.track("impresion");
      this.impressionObserver = new IntersectionObserver(function (entries) {
        if (entries.some(function (en) { return en.isIntersecting; })) {
          self.track("impresion");
          self.impressionObserver.disconnect();
        }
      }, { threshold: 0.5 });
      this.impressionObserver.observe(this);
    }

    // -------------------------------------------------------------------------
    // Configuración efectiva (super-admin + atributos)
    // -------------------------------------------------------------------------
    config() {
      var e = this.state.estilo || {};
      var a = this.getAttribute.bind(this);
      // Con el atributo "preview" (vista previa del super-admin) los atributos
      // ganan sobre lo guardado, para ver los cambios antes de guardarlos.
      var preview = this.hasAttribute("preview");
      var pick = function (attrName, saved) {
        return preview ? a(attrName) || saved : saved || a(attrName);
      };
      var tabsAttr = a("tabs");
      var tabs = tabsAttr
        ? tabsAttr.split(",").map(function (t) {
            return t.trim();
          }).filter(function (t) {
            return TAB_LABELS[t];
          })
        : ["partidos"].concat(e.mostrar_posiciones ? ["posiciones"] : [], e.mostrar_goleadores ? ["goleadores"] : []);
      if (tabs.length === 0) tabs = ["partidos"];

      var tema = a("theme") || e.tema || "oscuro";
      if (["oscuro", "claro", "auto"].indexOf(tema) === -1) tema = "oscuro";

      var prodeUrl = safeUrl(a("prode-url") || e.prode_url);
      return {
        primary: safeColor(pick("primary-color", e.color_primario), "#121214"),
        accent: safeColor(pick("secondary-color", e.color_secundario), "#00E676"),
        card: safeColor(pick("card-bg-color", e.color_fondo_tarjeta), "#121214"),
        text: safeColor(pick("main-text-color", e.color_texto_principal), "#f4f4f5"),
        muted: safeColor(pick("sub-text-color", e.color_texto_secundario), "#a1a1aa"),
        border1: safeColor(a("border-color-1") || e.color_borde_1, "#7F35B2"),
        border2: safeColor(a("border-color-2") || e.color_borde_2, "#EF426F"),
        font: FONT_STACKS[pick("font-family", e.fuente_familia)] || FONT_STACKS["sans-serif"],
        logo: safeUrl(pick("logo-url", e.logo_medio_url)),
        sponsorUrl: safeUrl(pick("sponsor-url", e.sponsor_url)),
        nombre: a("client-name") || this.state.nombreMedio || "",
        prodeUrl: prodeUrl,
        mostrarProde: Boolean(e.mostrar_prode && prodeUrl),
        mostrarEscudos: e.mostrar_escudos !== false,
        tema: tema,
        tabs: tabs,
      };
    }

    // -------------------------------------------------------------------------
    // Render: estructura fija (se arma una vez o cuando cambia el estilo)
    // -------------------------------------------------------------------------
    renderShell() {
      var c = this.config();
      this.cfg = c;
      if (c.tabs.indexOf(this.state.tab) === -1) this.state.tab = "partidos";

      var nombre = esc(c.nombre);
      var logoImg = c.logo ? '<img src="' + esc(c.logo) + '" alt="' + (nombre || "Logo") + '" />' : "";
      var brand = c.logo
        ? c.sponsorUrl
          ? '<a href="' + esc(c.sponsorUrl) + '" target="_blank" rel="noopener noreferrer sponsored" class="brand-link">' + logoImg + "</a>"
          : logoImg
        : '<span class="brand-name">' + nombre + "</span>";

      var tabsHtml =
        c.tabs.length > 1
          ? '<div class="tabs" role="tablist" aria-label="Secciones">' +
            c.tabs
              .map(function (t) {
                return (
                  '<button type="button" role="tab" class="tab" id="tab-' + t + '" data-tab="' + t +
                  '" aria-controls="panel-' + t + '">' + TAB_LABELS[t] + "</button>"
                );
              })
              .join("") +
            "</div>"
          : "";

      this.shadowRoot.innerHTML =
        "<style>" + this.css(c) + "</style>" +
        '<div class="box theme-' + c.tema + '">' +
        '<header class="brand">' + brand + "</header>" +
        tabsHtml +
        '<section class="panel" id="panel-partidos" role="tabpanel" aria-labelledby="tab-partidos">' +
        '<div class="chips" id="chips" role="group" aria-label="Filtrar partidos"></div>' +
        '<div class="slider-wrap">' +
        '<button type="button" class="nav nav-prev" id="btn-prev" aria-label="Partidos anteriores">' + ICON_PREV + "</button>" +
        '<div class="slider" id="slider" tabindex="0" aria-label="Partidos"></div>' +
        '<button type="button" class="nav nav-next" id="btn-next" aria-label="Partidos siguientes">' + ICON_NEXT + "</button>" +
        "</div></section>" +
        '<section class="panel" id="panel-posiciones" role="tabpanel" aria-labelledby="tab-posiciones" hidden></section>' +
        '<section class="panel" id="panel-goleadores" role="tabpanel" aria-labelledby="tab-goleadores" hidden></section>' +
        (c.mostrarProde
          ? '<div class="prode"><span>¿Quién gana esta fecha?</span><a href="' + esc(c.prodeUrl) +
            '" target="_top">¡Jugá al Prode y ganá! <span aria-hidden="true">➔</span></a></div>'
          : "") +
        '<footer class="credits"><a href="https://agenciamuove.com/" target="_blank" rel="noopener noreferrer">' +
        '<span>Creado por</span><img src="' + baseUrl + '/logo_muove.svg" alt="Muove" /></a></footer>' +
        '<div class="sr-only" aria-live="polite" id="announcer"></div>' +
        "</div>";

      this.bindSlider();
    }

    bindSlider() {
      var slider = this.shadowRoot.getElementById("slider");
      if (!slider) return;
      var self = this;
      var pause = function () {
        self.hovering = true;
      };
      var resume = function () {
        self.hovering = false;
        self.pauseUntil = Date.now() + AUTOPLAY_RESUME_MS;
      };
      slider.addEventListener("pointerenter", pause);
      slider.addEventListener("pointerleave", resume);
      slider.addEventListener("focusin", pause);
      slider.addEventListener("focusout", resume);
      slider.addEventListener("touchstart", pause, { passive: true });
      slider.addEventListener("touchend", resume, { passive: true });
      slider.addEventListener("scroll", function () {
        cancelAnimationFrame(self.navRaf);
        self.navRaf = requestAnimationFrame(self.updateNav.bind(self));
      }, { passive: true });
      slider.addEventListener("keydown", function (ev) {
        if (ev.key === "ArrowRight") { ev.preventDefault(); self.scrollStep(1); }
        if (ev.key === "ArrowLeft") { ev.preventDefault(); self.scrollStep(-1); }
      });
    }

    onShadowClick(ev) {
      if (ev.target.closest) {
        if (ev.target.closest(".brand-link")) this.track("sponsor");
        else if (ev.target.closest(".prode a")) this.track("prode");
      }
      var t = ev.target.closest ? ev.target.closest("[data-tab],[data-filter],[data-zona],[data-retry],#btn-prev,#btn-next") : null;
      if (!t) return;
      if (t.dataset.retry === undefined) this.track("interaccion");
      if (t.dataset.tab) {
        this.state.tab = t.dataset.tab;
        this.renderContent();
      } else if (t.dataset.filter) {
        this.state.filtro = t.dataset.filter;
        this.renderPartidos(null, true);
      } else if (t.dataset.zona) {
        this.state.zona = t.dataset.zona;
        this.renderStandings();
      } else if (t.dataset.retry !== undefined) {
        var kind = t.dataset.retry;
        if (kind === "partidos") {
          this.state.loading = true;
          this.state.error = null;
          this.renderContent();
          this.load();
        } else {
          this.state[kind === "posiciones" ? "standings" : "scorers"] = null;
          this.loadExtra(kind);
        }
      } else if (t.id === "btn-prev") {
        this.scrollStep(-1);
      } else if (t.id === "btn-next") {
        this.scrollStep(1);
      }
    }

    // -------------------------------------------------------------------------
    // Render: contenido
    // -------------------------------------------------------------------------
    renderContent(goals) {
      var root = this.shadowRoot;
      var tab = this.state.tab;
      (this.cfg ? this.cfg.tabs : ["partidos"]).forEach(function (t) {
        var btn = root.getElementById("tab-" + t);
        if (btn) {
          btn.setAttribute("aria-selected", String(t === tab));
          btn.tabIndex = t === tab ? 0 : -1;
        }
      });
      ["partidos", "posiciones", "goleadores"].forEach(function (t) {
        var panel = root.getElementById("panel-" + t);
        if (panel) panel.hidden = t !== tab;
      });

      if (tab === "partidos") this.renderPartidos(goals);
      else if (tab === "posiciones") this.renderStandings();
      else this.renderScorers();
    }

    groupOf(p, todayKey) {
      var d = toDate(p.fecha_hora);
      if (isLive(p) || (d && dayKey(d) === todayKey)) return "hoy";
      if (p.estado_partido === "programado" || p.estado_partido === "demorado") return "proximos";
      return "resultados";
    }

    renderPartidos(goals, filterChanged) {
      var root = this.shadowRoot;
      var slider = root.getElementById("slider");
      var chips = root.getElementById("chips");
      if (!slider || !chips) return;
      var s = this.state;

      if (s.loading) {
        chips.innerHTML = "";
        slider.dataset.keys = "";
        slider.innerHTML = '<div class="card skeleton"></div><div class="card skeleton"></div><div class="card skeleton"></div>';
        this.updateNav();
        return;
      }
      if (s.error && s.partidos.length === 0) {
        chips.innerHTML = "";
        slider.dataset.keys = "";
        slider.innerHTML =
          '<div class="empty"><p>' + esc(s.error) + "</p>" +
          '<button type="button" class="retry" data-retry="partidos">Reintentar</button></div>';
        this.updateNav();
        return;
      }
      if (s.partidos.length === 0) {
        chips.innerHTML = "";
        slider.dataset.keys = "";
        slider.innerHTML = '<div class="empty"><p>No hay partidos programados por ahora.</p></div>';
        this.updateNav();
        return;
      }

      // Agrupar
      var todayKey = dayKey(new Date(this.now()));
      var groups = { hoy: [], proximos: [], resultados: [] };
      var self = this;
      s.partidos.forEach(function (p) {
        groups[self.groupOf(p, todayKey)].push(p);
      });
      var available = ["hoy", "proximos", "resultados"].filter(function (g) {
        return groups[g].length > 0;
      });
      if (!s.filtro || groups[s.filtro].length === 0) s.filtro = available[0];

      var liveCount = s.partidos.filter(isLive).length;
      chips.hidden = available.length < 2;
      chips.innerHTML = available
        .map(function (g) {
          var dot = g === "hoy" && liveCount > 0 ? '<i class="dot" aria-hidden="true"></i>' : "";
          var extra = g === "hoy" && liveCount > 0 ? '<span class="sr-only"> (' + liveCount + " en vivo)</span>" : "";
          return (
            '<button type="button" class="chip" data-filter="' + g + '" aria-pressed="' + (g === s.filtro) + '">' +
            dot + FILTER_LABELS[g] + " <span class=\"count\">" + groups[g].length + "</span>" + extra + "</button>"
          );
        })
        .join("");

      var list = groups[s.filtro];
      var keys = list.map(function (p) {
        return p.id;
      }).join(",");
      var now = this.now();

      if (slider.dataset.keys === keys) {
        // Mismos partidos: solo se reemplazan las tarjetas que cambiaron.
        list.forEach(function (p) {
          var html = self.cardHtml(p, now);
          var el = slider.querySelector('[data-id="' + p.id + '"]');
          if (el && el.dataset.sig !== self.signature(p)) el.outerHTML = html;
        });
      } else {
        slider.innerHTML = list.map(function (p) {
          return self.cardHtml(p, now);
        }).join("");
        slider.dataset.keys = keys;
        if (filterChanged) slider.scrollLeft = 0;
      }

      if (goals && goals.size) this.celebrate(goals);
      this.updateNav();
    }

    signature(p) {
      return [
        p.estado_partido, p.goles_local, p.goles_visitante, p.fecha_hora, p.jornada, p.liga_nombre,
        p.equipo_local.nombre, p.equipo_local.logo, p.equipo_visitante.nombre, p.equipo_visitante.logo,
        p.reloj ? p.reloj.periodo + p.reloj.inicio : "",
      ].join("|");
    }

    cardHtml(p, now) {
      var d = toDate(p.fecha_hora);
      var estado = p.estado_partido;
      var gl = Number(p.goles_local) || 0;
      var gv = Number(p.goles_visitante) || 0;
      var hasScore = estado === "en_vivo" || estado === "finalizado" ||
        ((estado === "suspendido" || estado === "demorado") && (gl > 0 || gv > 0));

      var status;
      var aria;
      if (estado === "en_vivo") {
        var min = liveMinute(p, now);
        status = '<span class="live"><i class="dot" aria-hidden="true"></i>En vivo</span>' +
          '<span class="minute" data-min>' + esc(minuteLabel(min)) + "</span>";
        aria = "en vivo" + (min ? ", " + minuteLabel(min) : "");
      } else if (estado === "finalizado") {
        status = '<span class="tag">Final</span>' + (d ? "<span>" + esc(fmtDay(d, now)) + "</span>" : "");
        aria = "finalizado";
      } else if (estado === "suspendido") {
        status = '<span class="tag tag-red">Suspendido</span>';
        aria = "suspendido";
      } else if (estado === "demorado") {
        status = '<span class="tag tag-amber">Demorado</span>';
        aria = "demorado";
      } else if (estado === "a_confirmar") {
        status = '<span class="tag">Resultado a confirmar</span>';
        aria = "resultado a confirmar";
      } else {
        status = "<span>" + (d ? esc(fmtDay(d, now)) : "Fecha a confirmar") + "</span>";
        aria = d ? fmtDay(d, now) + " a las " + fmtTime(d) : "fecha a confirmar";
      }

      var center;
      if (hasScore) {
        center = '<div class="score"><span>' + gl + '</span><span class="sep">-</span><span>' + gv + "</span></div>";
      } else if (d && (estado === "programado" || estado === "demorado")) {
        center = '<div class="kickoff">' + esc(fmtTime(d)) + "<small>hs</small></div>";
      } else {
        center = '<div class="vs">vs</div>';
      }

      var self = this;
      var team = function (t) {
        var logo = self.cfg && !self.cfg.mostrarEscudos
          ? ""
          : '<img src="' + esc(safeUrl(t.logo) || PLACEHOLDER_LOGO) + '" alt="" loading="lazy" width="40" height="40" />';
        return '<div class="team">' + logo + '<span class="team-name" title="' + esc(t.nombre) + '">' + esc(t.nombre) + "</span></div>";
      };

      var label = p.equipo_local.nombre + " " + (hasScore ? gl + " a " + gv : "contra") + " " + p.equipo_visitante.nombre + ", " + aria;

      return (
        '<article class="card' + (estado === "en_vivo" ? " is-live" : "") + '" data-id="' + esc(p.id) +
        '" data-sig="' + esc(this.signature(p)) + '" role="group" aria-label="' + esc(label) + '">' +
        '<div class="card-league">' + esc(p.liga_nombre) + "</div>" +
        '<div class="card-meta"><div class="status">' + status + "</div>" +
        (p.jornada ? '<span class="round">' + esc(p.jornada) + "</span>" : "") + "</div>" +
        '<div class="card-body">' + team(p.equipo_local) + center + team(p.equipo_visitante) + "</div>" +
        '<div class="goal-banner" aria-hidden="true">¡GOL!</div>' +
        "</article>"
      );
    }

    celebrate(goals) {
      var root = this.shadowRoot;
      var announcer = root.getElementById("announcer");
      var mensajes = [];
      var self = this;
      goals.forEach(function (side, id) {
        var p = self.state.partidos.find(function (x) {
          return x.id === id;
        });
        if (!p) return;
        var equipo = side === "local" ? p.equipo_local.nombre : p.equipo_visitante.nombre;
        mensajes.push("Gol de " + equipo + ". " + p.equipo_local.nombre + " " + p.goles_local + ", " +
          p.equipo_visitante.nombre + " " + p.goles_visitante + ".");
        var el = root.querySelector('[data-id="' + id + '"]');
        if (!el) return;
        el.classList.add("goal", "goal-" + side);
        setTimeout(function () {
          var cur = root.querySelector('[data-id="' + id + '"]');
          if (cur) cur.classList.remove("goal", "goal-local", "goal-visitante");
        }, 6000);
        if (!self.reduceMotion.matches) {
          var slider = root.getElementById("slider");
          if (slider) slider.scrollTo({ left: el.offsetLeft - slider.offsetLeft - 40, behavior: "smooth" });
        }
        self.pauseUntil = Date.now() + 8000;
      });
      if (announcer && mensajes.length) announcer.textContent = mensajes.join(" ");
    }

    tickMinutes() {
      if (document.hidden || this.state.tab !== "partidos") return;
      var root = this.shadowRoot;
      var now = this.now();
      this.state.partidos.forEach(function (p) {
        if (!isLive(p)) return;
        var el = root.querySelector('[data-id="' + p.id + '"] [data-min]');
        if (el) el.textContent = minuteLabel(liveMinute(p, now));
      });
    }

    renderStandings() {
      var panel = this.shadowRoot.getElementById("panel-posiciones");
      if (!panel) return;
      var st = this.state.standings;
      if (!st) return this.loadExtra("posiciones");
      if (st === "loading") {
        panel.innerHTML = '<div class="table-skeleton"></div>';
        return;
      }
      if (st.error) {
        panel.innerHTML = '<div class="empty"><p>No se pudo cargar la tabla.</p><button type="button" class="retry" data-retry="posiciones">Reintentar</button></div>';
        return;
      }
      var zona = this.state.zona;
      var hasB = st.B.length > 0;
      var rows = (zona === "B" && hasB ? st.B : st.A)
        .map(function (r) {
          var dg = Number(r.diferenciaGol) || 0;
          return (
            "<tr><td class=\"pos\">" + esc(r.posicion) + "</td>" +
            '<td class="team-cell"><div class="tc">' + (r.logo ? '<img src="' + esc(safeUrl(r.logo)) + '" alt="" loading="lazy" width="20" height="20" />' : "") +
            "<span>" + esc(r.equipo) + "</span></div></td>" +
            "<td>" + esc(r.jugados) + '</td><td class="hide-sm">' + esc(r.ganados) + '</td><td class="hide-sm">' + esc(r.empatados) +
            '</td><td class="hide-sm">' + esc(r.perdidos) + "</td><td>" + (dg > 0 ? "+" : "") + esc(dg) + '</td><td class="pts">' + esc(r.puntos) + "</td></tr>"
          );
        })
        .join("");

      panel.innerHTML =
        '<div class="panel-head"><span class="panel-title">' + esc(st.nombre) + "</span>" +
        (hasB
          ? '<div class="seg" role="group" aria-label="Zona">' +
            ["A", "B"].map(function (z) {
              return '<button type="button" data-zona="' + z + '" aria-pressed="' + (z === zona) + '">Zona ' + z + "</button>";
            }).join("") + "</div>"
          : "") +
        "</div>" +
        '<div class="table-scroll"><table><thead><tr><th class="pos">#</th><th class="team-cell">Equipo</th>' +
        '<th title="Partidos jugados">PJ</th><th class="hide-sm" title="Ganados">G</th><th class="hide-sm" title="Empatados">E</th>' +
        '<th class="hide-sm" title="Perdidos">P</th><th title="Diferencia de gol">DG</th><th class="pts">Pts</th></tr></thead>' +
        "<tbody>" + rows + "</tbody></table></div>" + sourceNote(st.fuente);
    }

    renderScorers() {
      var panel = this.shadowRoot.getElementById("panel-goleadores");
      if (!panel) return;
      var sc = this.state.scorers;
      if (!sc) return this.loadExtra("goleadores");
      if (sc === "loading") {
        panel.innerHTML = '<div class="table-skeleton"></div>';
        return;
      }
      if (sc.error || sc.lista.length === 0) {
        panel.innerHTML = '<div class="empty"><p>' + (sc.error ? "No se pudo cargar la tabla de goleadores." : "Todavía no hay goleadores.") +
          "</p>" + (sc.error ? '<button type="button" class="retry" data-retry="goleadores">Reintentar</button>' : "") + "</div>";
        return;
      }
      panel.innerHTML =
        '<ol class="scorers">' +
        sc.lista.slice(0, 10).map(function (g, i, arr) {
          // Empates de goles comparten puesto (5, 5, 5... en lugar de 5, 6, 7).
          var pos = i + 1;
          while (pos > 1 && Number(arr[pos - 2].goles) === Number(g.goles)) pos--;
          return (
            '<li><span class="pos">' + pos + "</span>" +
            (g.logo ? '<img src="' + esc(safeUrl(g.logo)) + '" alt="" loading="lazy" width="24" height="24" />' : '<span class="logo-gap"></span>') +
            '<span class="who"><strong>' + esc(g.nombre) + "</strong><small>" + esc(g.equipo) + "</small></span>" +
            '<span class="goals">' + esc(g.goles) + "<small> goles</small></span></li>"
          );
        }).join("") +
        "</ol>" + sourceNote(sc.fuente);
    }

    // -------------------------------------------------------------------------
    // Carrusel
    // -------------------------------------------------------------------------
    scrollStep(dir) {
      var slider = this.shadowRoot.getElementById("slider");
      if (!slider) return;
      var card = slider.querySelector(".card");
      var step = card ? card.getBoundingClientRect().width + 12 : 300;
      slider.scrollBy({ left: dir * step, behavior: this.reduceMotion.matches ? "auto" : "smooth" });
      this.pauseUntil = Date.now() + AUTOPLAY_RESUME_MS;
    }

    updateNav() {
      var root = this.shadowRoot;
      var slider = root.getElementById("slider");
      var prev = root.getElementById("btn-prev");
      var next = root.getElementById("btn-next");
      if (!slider || !prev || !next) return;
      var max = slider.scrollWidth - slider.clientWidth;
      var overflow = max > 4;
      prev.hidden = next.hidden = !overflow;
      prev.disabled = slider.scrollLeft <= 4;
      next.disabled = slider.scrollLeft >= max - 4;
    }

    autoplayStep() {
      if (this.reduceMotion.matches || this.hovering || document.hidden) return;
      if (Date.now() < this.pauseUntil || this.state.tab !== "partidos") return;
      var slider = this.shadowRoot.getElementById("slider");
      if (!slider) return;
      var max = slider.scrollWidth - slider.clientWidth;
      if (max <= 4) return;
      if (slider.scrollLeft >= max - 4) slider.scrollTo({ left: 0, behavior: "smooth" });
      else {
        var card = slider.querySelector(".card");
        var step = card ? card.getBoundingClientRect().width + 12 : 300;
        slider.scrollBy({ left: step, behavior: "smooth" });
      }
    }

    // -------------------------------------------------------------------------
    // Estilos
    // -------------------------------------------------------------------------
    css(c) {
      var accentInk = inkFor(c.accent);
      var brandInk = inkFor(c.primary);
      var light =
        "--bg:#f4f4f5;--surface:#ffffff;--surface-2:#fafafa;--line:#e4e4e7;--text:#18181b;--muted:#52525b;--skeleton:#e4e4e7;";
      var dark =
        "--bg:#09090b;--surface:" + c.card + ";--surface-2:#0f0f12;--line:#27272a;--text:" + c.text +
        ";--muted:" + c.muted + ";--skeleton:#1f1f23;";

      return [
        ":host{display:block;width:100%;position:relative;box-sizing:border-box;border-radius:20px;padding:3px;overflow:hidden;isolation:isolate;",
        "font-family:" + c.font + ";--accent:" + c.accent + ";--accent-ink:" + accentInk + ";--brand-bg:" + c.primary + ";--brand-ink:" + brandInk + ";}",
        "*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}",
        "[hidden]{display:none!important}",
        ".sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}",

        // Borde animado
        "@keyframes spin{to{transform:rotate(360deg)}}",
        ":host::before,:host::after{content:'';position:absolute;inset:-50%;z-index:-1;pointer-events:none;",
        "background:conic-gradient(from 0deg,transparent 0deg,transparent 130deg," + withAlpha(c.border1, 0.35) + " 180deg," + c.border1 + " 240deg," + c.border2 + " 310deg," + c.border1 + " 360deg);",
        "animation:spin 3.6s linear infinite}",
        ":host::after{filter:blur(12px);opacity:.85}",

        ".box{position:relative;border-radius:17px;overflow:hidden;background:var(--bg);color:var(--text);",
        "box-shadow:inset 0 1px 2px rgba(255,255,255,.12)}",
        ".theme-oscuro{" + dark + "}",
        ".theme-claro{" + light + "}",
        ".theme-auto{" + dark + "}",
        "@media (prefers-color-scheme:light){.theme-auto{" + light + "}}",

        // Cabecera
        ".brand{background:var(--brand-bg);display:flex;align-items:center;justify-content:center;padding:12px 16px;min-height:64px;border-bottom:1px solid var(--line)}",
        ".brand img{max-width:clamp(180px,55%,380px);height:clamp(44px,9vw,76px);object-fit:contain;mix-blend-mode:multiply}",
        ".brand-link{display:flex;align-items:center;justify-content:center;border-radius:8px}",
        ".brand-name{color:var(--brand-ink);font-weight:800;font-size:16px;letter-spacing:.3px}",

        // Pestañas
        ".tabs{display:flex;gap:4px;padding:8px 12px 0;background:var(--bg);border-bottom:1px solid var(--line)}",
        ".tab{flex:1;background:none;border:0;border-bottom:2px solid transparent;color:var(--muted);font:inherit;font-size:12px;font-weight:800;",
        "text-transform:uppercase;letter-spacing:.6px;padding:8px 6px 10px;cursor:pointer;transition:color .2s,border-color .2s}",
        ".tab:hover{color:var(--text)}",
        ".tab[aria-selected=true]{color:var(--text);border-bottom-color:var(--accent)}",

        // Filtros
        ".chips{display:flex;gap:6px;padding:12px 16px 0;flex-wrap:wrap}",
        ".chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:var(--surface-2);color:var(--muted);",
        "font:inherit;font-size:11px;font-weight:700;padding:6px 12px;border-radius:999px;cursor:pointer;transition:all .2s}",
        ".chip:hover{color:var(--text)}",
        ".chip[aria-pressed=true]{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}",
        ".chip .count{opacity:.7;font-weight:600}",
        ".chip[aria-pressed=true] .dot{background:var(--accent-ink);animation:none}",

        // Carrusel
        ".slider-wrap{position:relative}",
        ".slider{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding:0 40px;padding:14px 40px 16px;",
        "scrollbar-width:none;outline:none;min-height:184px;align-items:stretch}",
        ".slider::-webkit-scrollbar{display:none}",
        ".slider:focus-visible{box-shadow:inset 0 0 0 2px var(--accent)}",
        ".nav{position:absolute;top:0;bottom:0;width:32px;border:0;background:var(--accent);color:var(--accent-ink);display:flex;",
        "align-items:center;justify-content:center;cursor:pointer;z-index:2;transition:opacity .2s}",
        ".nav:disabled{opacity:.35;cursor:default}",
        ".nav svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}",
        ".nav-prev{left:0}.nav-next{right:0}",
        ".nav:focus-visible,.chip:focus-visible,.tab:focus-visible,.retry:focus-visible,.seg button:focus-visible,a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}",

        // Tarjeta
        ".card{position:relative;flex:0 0 288px;scroll-snap-align:start;background:var(--surface);border:1px solid var(--line);border-radius:12px;",
        "overflow:hidden;display:flex;flex-direction:column;transition:border-color .25s,transform .25s,box-shadow .25s}",
        ".card:hover{transform:translateY(-2px);border-color:" + withAlpha(c.accent, 0.5) + "}",
        ".card.is-live{border-color:" + withAlpha(c.accent, 0.55) + ";box-shadow:0 0 0 1px " + withAlpha(c.accent, 0.25) + ",0 6px 24px " + withAlpha(c.accent, 0.12) + "}",
        ".card-league{background:var(--accent);color:var(--accent-ink);font-size:9.5px;font-weight:800;text-align:center;padding:6px 10px;",
        "text-transform:uppercase;letter-spacing:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
        ".card-meta{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 12px;background:var(--surface-2);",
        "border-bottom:1px solid var(--line);color:var(--muted);font-size:10px;font-weight:700;min-height:31px}",
        ".status{display:flex;align-items:center;gap:8px;white-space:nowrap}",
        ".round{opacity:.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:45%}",
        ".live{display:inline-flex;align-items:center;gap:5px;color:#22c55e;text-transform:uppercase;font-weight:800;letter-spacing:.4px}",
        ".minute{color:var(--text);font-weight:800;font-variant-numeric:tabular-nums}",
        ".dot{width:7px;height:7px;border-radius:50%;background:#22c55e;display:inline-block;box-shadow:0 0 0 0 rgba(34,197,94,.6);animation:pulse 1.6s infinite}",
        "@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.6)}70%{box-shadow:0 0 0 7px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}",
        ".tag{text-transform:uppercase;font-weight:800;letter-spacing:.4px;color:var(--text)}",
        ".tag-red{color:#ef4444;background:rgba(239,68,68,.14);padding:2px 6px;border-radius:4px}",
        ".tag-amber{color:#f59e0b;background:rgba(245,158,11,.14);padding:2px 6px;border-radius:4px}",
        ".card-body{flex:1;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:6px;padding:16px 12px}",
        ".team{display:flex;flex-direction:column;align-items:center;gap:7px;min-width:0;text-align:center}",
        ".team img{width:40px;height:40px;object-fit:contain;filter:drop-shadow(0 2px 4px rgba(0,0,0,.45))}",
        ".team-name{color:var(--text);font-size:10.5px;font-weight:700;text-transform:uppercase;line-height:1.25;width:100%;",
        "display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}",
        ".score{display:flex;align-items:center;gap:6px;font-size:24px;font-weight:900;color:var(--text);font-variant-numeric:tabular-nums;padding:0 4px}",
        ".score .sep{color:var(--muted);font-weight:400;font-size:18px}",
        ".kickoff{font-size:18px;font-weight:900;color:var(--text);font-variant-numeric:tabular-nums;text-align:center}",
        ".kickoff small{display:block;font-size:9px;font-weight:700;color:var(--muted);letter-spacing:.6px;text-transform:uppercase}",
        ".vs{font-size:13px;font-weight:800;color:var(--muted);text-transform:uppercase}",

        // Gol
        ".goal-banner{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%) scale(.6);opacity:0;pointer-events:none;",
        "background:var(--accent);color:var(--accent-ink);font-weight:900;font-size:22px;letter-spacing:1px;padding:6px 16px;border-radius:10px;",
        "box-shadow:0 8px 30px " + withAlpha(c.accent, 0.45) + "}",
        ".card.goal{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent)}",
        ".card.goal .goal-banner{animation:goal 2.4s ease-out 1 forwards}",
        ".card.goal .score{animation:bump .6s ease-out 3}",
        "@keyframes goal{0%{opacity:0;transform:translate(-50%,-50%) scale(.6)}15%{opacity:1;transform:translate(-50%,-50%) scale(1.08)}",
        "30%{transform:translate(-50%,-50%) scale(1)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(1)}}",
        "@keyframes bump{50%{transform:scale(1.18)}}",

        // Esqueletos y vacíos
        ".skeleton{min-height:168px;background:linear-gradient(90deg,var(--skeleton) 0%,var(--surface-2) 50%,var(--skeleton) 100%);",
        "background-size:200% 100%;animation:shimmer 1.4s linear infinite;border-color:transparent}",
        ".table-skeleton{height:220px;margin:16px;border-radius:12px;background:linear-gradient(90deg,var(--skeleton) 0%,var(--surface-2) 50%,var(--skeleton) 100%);",
        "background-size:200% 100%;animation:shimmer 1.4s linear infinite}",
        "@keyframes shimmer{to{background-position:-200% 0}}",
        ".empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--muted);",
        "font-size:12px;text-align:center;padding:28px 16px;min-height:150px}",
        ".retry{font:inherit;font-size:11px;font-weight:800;border:1px solid var(--accent);color:var(--text);background:transparent;",
        "padding:6px 14px;border-radius:999px;cursor:pointer}",

        // Posiciones
        ".panel-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px 4px;flex-wrap:wrap}",
        ".panel-title{font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.6px}",
        ".seg{display:inline-flex;border:1px solid var(--line);border-radius:999px;overflow:hidden}",
        ".seg button{font:inherit;font-size:11px;font-weight:700;background:transparent;color:var(--muted);border:0;padding:5px 12px;cursor:pointer}",
        ".seg button[aria-pressed=true]{background:var(--accent);color:var(--accent-ink)}",
        ".table-scroll{max-height:340px;overflow:auto;padding:0 12px 14px}",
        "table{width:100%;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums}",
        "th{position:sticky;top:0;background:var(--bg);color:var(--muted);font-size:10px;font-weight:800;text-transform:uppercase;padding:8px 6px;text-align:center}",
        "td{padding:7px 6px;text-align:center;border-top:1px solid var(--line);color:var(--text)}",
        ".team-cell{text-align:left}",
        ".tc{display:flex;align-items:center;gap:8px;min-width:0;max-width:200px}",
        ".tc span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600}",
        ".tc img{width:20px;height:20px;object-fit:contain;flex-shrink:0}",
        ".pos{width:28px;color:var(--muted);font-weight:700}",
        ".pts{font-weight:900}",
        "tbody tr:nth-child(-n+4) .pos{color:var(--accent)}",

        // Goleadores
        ".scorers{list-style:none;padding:8px 16px 14px}",
        ".scorers li{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--line)}",
        ".scorers li:first-child{border-top:0}",
        ".scorers .pos{width:22px;text-align:center}",
        ".scorers img,.logo-gap{width:24px;height:24px;object-fit:contain;flex-shrink:0}",
        ".who{flex:1;min-width:0;display:flex;flex-direction:column}",
        ".who strong{font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
        ".who small{font-size:10.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
        ".goals{font-size:18px;font-weight:900;font-variant-numeric:tabular-nums}",
        ".goals small{font-size:9.5px;color:var(--muted);font-weight:700}",

        // Prode y créditos
        ".prode{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 16px;border-top:1px solid var(--line);background:var(--surface-2)}",
        ".prode span{color:var(--muted);font-size:11px;font-weight:700}",
        ".prode a{color:var(--accent);font-size:11.5px;font-weight:800;text-decoration:none;display:inline-flex;gap:6px;transition:transform .2s}",
        ".prode a:hover{transform:translateX(3px)}",
        ".source{margin:0;padding:4px 16px 10px;font-size:10px;color:var(--muted);text-align:right}",
        ".source a{color:inherit}",
        ".credits{display:flex;justify-content:flex-end;padding:8px 16px;border-top:1px solid var(--line)}",
        ".credits a{display:flex;align-items:center;gap:6px;text-decoration:none;opacity:.7}",
        ".credits span{color:var(--muted);font-size:8px;font-weight:700}",
        ".credits img{height:9.5px}",

        // Celulares
        "@media (max-width:640px){",
        ".slider{padding:12px 34px 14px;gap:10px;scroll-padding:0 34px}",
        ".card{flex-basis:min(82vw,300px)}",
        ".nav{width:26px}",
        ".hide-sm{display:none}",
        ".prode{flex-direction:column;text-align:center}",
        "}",

        // Movimiento reducido
        "@media (prefers-reduced-motion:reduce){",
        ":host::before,:host::after,.dot,.skeleton,.table-skeleton{animation:none}",
        ".card,.card:hover{transition:none;transform:none}",
        ".card.goal .goal-banner{animation:none;opacity:1;transform:translate(-50%,-50%)}",
        ".card.goal .score{animation:none}",
        "}",
      ].join("");
    }
  }

  if (!customElements.get("futbol-widget")) {
    customElements.define("futbol-widget", FutbolWidget);
  }
})();
