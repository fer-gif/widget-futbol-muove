// Reloj de partido: decide el estado visible y el minuto a mostrar.
// Se usa en la API del widget y en el panel del periodista.
// public/widget.js tiene una copia en JS plano (función liveMinute) para que el
// minuto avance solo en el navegador: si cambiás la lógica, cambiá las dos.

export type Periodo = "1T" | "ET" | "2T";

export type ClockInput = {
  estado_partido: string;
  fecha_hora?: string | null;
  minuto_actual?: number | null;
  periodo?: string | null;
  periodo_inicio?: string | null;
};

export type ClockOutput = {
  /** programado | en_vivo | finalizado | suspendido | demorado | a_confirmar */
  estado: string;
  /** Texto listo para mostrar: "37'", "45+", "ET"... o null si no corresponde. */
  minuto: string | null;
  /** true si el minuto sale del horario programado y no de lo que cargó el periodista. */
  estimado: boolean;
};

/** Pasado este tiempo desde el inicio programado sin que nadie lo cierre, se muestra "a confirmar". */
export const LIVE_WINDOW_MIN = 130;

const toMs = (v?: string | null) => (v ? new Date(v).getTime() : NaN);

export function matchClock(p: ClockInput, now: number = Date.now()): ClockOutput {
  let estado = p.estado_partido;
  const start = toMs(p.fecha_hora);

  // Programado pero ya pasó la hora de inicio: en vivo estimado, o a confirmar si pasó demasiado.
  if (estado === "programado") {
    if (isNaN(start) || now < start) return { estado, minuto: null, estimado: false };
    if (now - start > LIVE_WINDOW_MIN * 60000) return { estado: "a_confirmar", minuto: null, estimado: true };
    estado = "en_vivo";
  }

  if (estado !== "en_vivo") return { estado, minuto: null, estimado: false };

  // 1. Reloj cargado por el periodista (botones Iniciar 1T / ET / Iniciar 2T).
  if (p.periodo === "ET") return { estado, minuto: "ET", estimado: false };
  const inicio = toMs(p.periodo_inicio);
  if ((p.periodo === "1T" || p.periodo === "2T") && !isNaN(inicio)) {
    const base = p.periodo === "1T" ? 0 : 45;
    const transcurrido = Math.max(1, Math.floor((now - inicio) / 60000) + 1);
    const total = base + transcurrido;
    const tope = base + 45;
    return { estado, minuto: total > tope ? `${tope}+` : `${total}'`, estimado: false };
  }

  // 2. Minuto escrito a mano.
  if (p.minuto_actual !== null && p.minuto_actual !== undefined) {
    return { estado, minuto: `${p.minuto_actual}'`, estimado: false };
  }

  // 3. Estimación a partir del horario programado.
  if (!isNaN(start) && now >= start) {
    const diff = Math.floor((now - start) / 60000);
    const minuto = diff < 45 ? `${diff + 1}'` : diff < 60 ? "ET" : diff < 105 ? `${diff - 14}'` : "90+";
    return { estado, minuto, estimado: true };
  }
  return { estado, minuto: null, estimado: true };
}
