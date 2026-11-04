// Configuración visual del widget por cliente.
// Fuente de verdad: columna jsonb `configuracion_widgets.config`.
// Se mantiene compatibilidad de LECTURA con el formato heredado que
// guardaba los valores dentro de logo_medio_url ("<logo>___CFG___a|b|c...").

export type WidgetConfig = {
  color_primario: string;
  color_secundario: string;
  color_fondo_tarjeta: string;
  color_texto_principal: string;
  color_texto_secundario: string;
  color_borde_1: string;
  color_borde_2: string;
  fuente_familia: FontKey;
  logo_medio_url: string;
  sponsor_url: string;
  mostrar_escudos: boolean;
  mostrar_prode: boolean;
  prode_url: string;
  tema: Tema;
  mostrar_posiciones: boolean;
  mostrar_goleadores: boolean;
};

export const FONT_KEYS = ["sans-serif", "serif", "montserrat", "inter", "poppins"] as const;
export type FontKey = (typeof FONT_KEYS)[number];

export const TEMAS = ["oscuro", "claro", "auto"] as const;
export type Tema = (typeof TEMAS)[number];

export const DEFAULT_WIDGET_CONFIG: WidgetConfig = {
  color_primario: "#121214",
  color_secundario: "#00E676",
  color_fondo_tarjeta: "#121214",
  color_texto_principal: "#f4f4f5",
  color_texto_secundario: "#a1a1aa",
  color_borde_1: "#7F35B2",
  color_borde_2: "#EF426F",
  fuente_familia: "sans-serif",
  logo_medio_url: "",
  sponsor_url: "",
  mostrar_escudos: true,
  mostrar_prode: false,
  prode_url: "",
  tema: "oscuro",
  mostrar_posiciones: false,
  mostrar_goleadores: false,
};

const LEGACY_SEP = "___CFG___";
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function safeColor(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX.test(value.trim()) ? value.trim() : fallback;
}

/** Solo acepta URLs http(s) absolutas; cualquier otra cosa (javascript:, data:, etc.) se descarta. */
export function safeUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const u = new URL(value.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : "";
  } catch {
    return "";
  }
}

function safeTema(value: unknown): Tema {
  return TEMAS.includes(value as Tema) ? (value as Tema) : "oscuro";
}

function safeFont(value: unknown): FontKey {
  return FONT_KEYS.includes(value as FontKey) ? (value as FontKey) : "sans-serif";
}

type ConfigRow = {
  color_primario?: string | null;
  color_secundario?: string | null;
  logo_medio_url?: string | null;
  mostrar_escudos?: boolean | null;
  config?: Partial<Record<keyof WidgetConfig, unknown>> | null;
} | null | undefined;

/** Normaliza una fila de configuracion_widgets a un WidgetConfig seguro. */
export function parseWidgetConfig(row: ConfigRow): WidgetConfig {
  const d = DEFAULT_WIDGET_CONFIG;
  if (!row) return { ...d };

  let logo = row.logo_medio_url || "";
  let legacy: Partial<Record<keyof WidgetConfig, unknown>> = {};
  if (logo.includes(LEGACY_SEP)) {
    const [base, rest] = logo.split(LEGACY_SEP);
    logo = base || "";
    const p = (rest || "").split("|");
    legacy = {
      color_fondo_tarjeta: p[0],
      color_texto_principal: p[1],
      color_texto_secundario: p[2],
      fuente_familia: p[3],
      color_borde_1: p[4],
      color_borde_2: p[5],
      sponsor_url: p[6],
    };
  }

  // El jsonb nuevo tiene prioridad sobre el formato heredado.
  const c = { ...legacy, ...(row.config || {}) };

  return {
    color_primario: safeColor(row.color_primario, d.color_primario),
    color_secundario: safeColor((row.color_secundario || "").split("|")[0], d.color_secundario),
    color_fondo_tarjeta: safeColor(c.color_fondo_tarjeta, d.color_fondo_tarjeta),
    color_texto_principal: safeColor(c.color_texto_principal, d.color_texto_principal),
    color_texto_secundario: safeColor(c.color_texto_secundario, d.color_texto_secundario),
    color_borde_1: safeColor(c.color_borde_1, d.color_borde_1),
    color_borde_2: safeColor(c.color_borde_2, d.color_borde_2),
    fuente_familia: safeFont(c.fuente_familia),
    logo_medio_url: safeUrl(logo),
    sponsor_url: safeUrl(c.sponsor_url),
    mostrar_escudos: row.mostrar_escudos !== false,
    mostrar_prode: c.mostrar_prode === true,
    prode_url: safeUrl(c.prode_url),
    tema: safeTema(c.tema),
    mostrar_posiciones: c.mostrar_posiciones === true,
    mostrar_goleadores: c.mostrar_goleadores === true,
  };
}

/** Arma la fila a guardar en configuracion_widgets a partir de un WidgetConfig. */
export function toConfigRow(cfg: WidgetConfig) {
  const d = DEFAULT_WIDGET_CONFIG;
  return {
    color_primario: safeColor(cfg.color_primario, d.color_primario),
    color_secundario: safeColor(cfg.color_secundario, d.color_secundario),
    logo_medio_url: safeUrl(cfg.logo_medio_url) || null,
    mostrar_escudos: cfg.mostrar_escudos,
    config: {
      color_fondo_tarjeta: safeColor(cfg.color_fondo_tarjeta, d.color_fondo_tarjeta),
      color_texto_principal: safeColor(cfg.color_texto_principal, d.color_texto_principal),
      color_texto_secundario: safeColor(cfg.color_texto_secundario, d.color_texto_secundario),
      color_borde_1: safeColor(cfg.color_borde_1, d.color_borde_1),
      color_borde_2: safeColor(cfg.color_borde_2, d.color_borde_2),
      fuente_familia: safeFont(cfg.fuente_familia),
      sponsor_url: safeUrl(cfg.sponsor_url),
      mostrar_prode: Boolean(cfg.mostrar_prode),
      prode_url: safeUrl(cfg.prode_url),
      tema: safeTema(cfg.tema),
      mostrar_posiciones: Boolean(cfg.mostrar_posiciones),
      mostrar_goleadores: Boolean(cfg.mostrar_goleadores),
    },
  };
}
