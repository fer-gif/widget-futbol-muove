-- ============================================================================
-- 004 · Reloj en vivo y pestañas del widget
-- ----------------------------------------------------------------------------
-- Aditiva y compatible con el código anterior. Correr en Supabase → SQL Editor.
-- ============================================================================

-- 1. Reloj del partido: el periodista marca el inicio de cada tiempo y el
--    widget calcula el minuto solo (ya no hay que escribirlo a mano).
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS periodo VARCHAR(4);
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS periodo_inicio TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'partidos_periodo_check') THEN
    ALTER TABLE partidos
      ADD CONSTRAINT partidos_periodo_check CHECK (periodo IS NULL OR periodo IN ('1T', 'ET', '2T'));
  END IF;
END $$;

-- 2. Pestañas Posiciones y Goleadores: hoy todos los medios usan la Liga
--    Necochea, así que se activan para los existentes. Se apagan por medio
--    desde el super-admin.
UPDATE configuracion_widgets
SET config = config || '{"mostrar_posiciones": true, "mostrar_goleadores": true}'::jsonb
WHERE liga_id IS NULL
  AND color_primario IS DISTINCT FROM 'NOTICIAS_STORE'
  AND NOT (config ? 'mostrar_posiciones');
