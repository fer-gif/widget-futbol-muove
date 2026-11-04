-- ============================================================================
-- 001 · Configuración del widget en JSON, claves hasheadas y límite de intentos
-- ----------------------------------------------------------------------------
-- Es ADITIVA y compatible con el código actual: se puede correr ANTES del deploy.
-- Ejecutar en Supabase → SQL Editor. Es idempotente (se puede correr más de una vez).
-- ============================================================================

-- 1. Configuración visual en una columna jsonb (reemplaza el truco "___CFG___") --
ALTER TABLE configuracion_widgets
  ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Copiar los valores heredados guardados dentro de logo_medio_url.
-- logo_medio_url NO se modifica todavía (el código viejo lo sigue leyendo); el
-- código nuevo ignora el sufijo y lee `config`. Lo ya presente en `config` gana.
UPDATE configuracion_widgets
SET config = jsonb_strip_nulls(jsonb_build_object(
      'color_fondo_tarjeta',    NULLIF(split_part(split_part(logo_medio_url, '___CFG___', 2), '|', 1), ''),
      'color_texto_principal',  NULLIF(split_part(split_part(logo_medio_url, '___CFG___', 2), '|', 2), ''),
      'color_texto_secundario', NULLIF(split_part(split_part(logo_medio_url, '___CFG___', 2), '|', 3), ''),
      'fuente_familia',         NULLIF(split_part(split_part(logo_medio_url, '___CFG___', 2), '|', 4), ''),
      'color_borde_1',          NULLIF(split_part(split_part(logo_medio_url, '___CFG___', 2), '|', 5), ''),
      'color_borde_2',          NULLIF(split_part(split_part(logo_medio_url, '___CFG___', 2), '|', 6), ''),
      'sponsor_url',            NULLIF(split_part(split_part(logo_medio_url, '___CFG___', 2), '|', 7), '')
    )) || config
WHERE strpos(COALESCE(logo_medio_url, ''), '___CFG___') > 0
  AND color_primario IS DISTINCT FROM 'NOTICIAS_STORE';

-- El banner del Prode ya no está escrito en el código para DataNE: pasa a ser config.
UPDATE configuracion_widgets cw
SET config = cw.config || '{"mostrar_prode": true, "prode_url": "https://dataene.com.ar/futbol-neco/"}'::jsonb
FROM clientes c
WHERE c.id = cw.cliente_id
  AND cw.liga_id IS NULL
  AND cw.color_primario IS DISTINCT FROM 'NOTICIAS_STORE'
  AND (c.nombre_medio ILIKE '%datane%' OR c.nombre_medio ILIKE '%dataene%')
  AND NOT (cw.config ? 'mostrar_prode');

INSERT INTO configuracion_widgets (cliente_id, liga_id, config)
SELECT c.id, NULL, '{"mostrar_prode": true, "prode_url": "https://dataene.com.ar/futbol-neco/"}'::jsonb
FROM clientes c
WHERE (c.nombre_medio ILIKE '%datane%' OR c.nombre_medio ILIKE '%dataene%')
  AND NOT EXISTS (
    SELECT 1 FROM configuracion_widgets w
    WHERE w.cliente_id = c.id AND w.liga_id IS NULL
      AND w.color_primario IS DISTINCT FROM 'NOTICIAS_STORE'
  );

-- 2. Claves de periodista hasheadas ------------------------------------------
-- El hash se genera desde la app (scrypt): al primer login de cada periodista y,
-- para todos los medios a la vez, cuando el super-admin inicia sesión.
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS clave_hash TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clientes' AND column_name = 'clave_periodista'
  ) THEN
    ALTER TABLE clientes ALTER COLUMN clave_periodista DROP NOT NULL;
    ALTER TABLE clientes ALTER COLUMN clave_periodista DROP DEFAULT;
  END IF;
END $$;

-- 3. Límite de intentos de login (periodistas, super-admin y Prode) -----------
CREATE TABLE IF NOT EXISTS auth_intentos (
    clave TEXT PRIMARY KEY,                    -- ej: "p:<cliente>:<ip>", "prode:<cliente>:<email>"
    fallos INTEGER NOT NULL DEFAULT 0,
    bloqueado_hasta TIMESTAMPTZ,
    actualizado_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Sin políticas: solo el servidor (service role) puede leerla o escribirla.
ALTER TABLE auth_intentos ENABLE ROW LEVEL SECURITY;

-- 4. Índices para las consultas del widget ------------------------------------
CREATE INDEX IF NOT EXISTS idx_partidos_liga_fecha ON partidos (liga_id, fecha_hora);
CREATE INDEX IF NOT EXISTS idx_partidos_estado ON partidos (estado_partido);
CREATE INDEX IF NOT EXISTS idx_clientes_ligas_cliente ON clientes_ligas (cliente_id);
