-- ============================================================================
-- 006 · Posiciones calculadas, goleadores editables y carga desde ahorafutbol.ar
-- ----------------------------------------------------------------------------
-- Aditiva. Correr en Supabase → SQL Editor. Se puede correr más de una vez.
--
-- - Las posiciones se calculan con los partidos finalizados que cargan los
--   diarios, agrupando por la zona de cada equipo.
-- - Los goleadores pasan a una tabla que editan los diarios y el super-admin.
-- - ahorafutbol.ar se usa solo para ponerse al día (botón en el super-admin):
--   los números de club, liga y partido evitan duplicar al importar.
-- ============================================================================

-- 1. Liga: número en ahorafutbol.ar e inicio del torneo actual ----------------
ALTER TABLE ligas ADD COLUMN IF NOT EXISTS ahorafutbol_id INTEGER;
-- Solo cuentan para la tabla los partidos desde esta fecha (NULL = todos).
ALTER TABLE ligas ADD COLUMN IF NOT EXISTS torneo_inicio DATE;

-- Liga Necochea 1ra. División Masculino = ligas.php?i=1. El torneo 2026
-- ("Sergio Giuseppe Portugal") arrancó el 28/03/2026.
UPDATE ligas
SET ahorafutbol_id = COALESCE(ahorafutbol_id, 1),
    torneo_inicio  = COALESCE(torneo_inicio, DATE '2026-03-01')
WHERE id = '1b8540e8-4276-4f9b-a502-a045e216c942';

-- 2. Equipos: número de club en el sitio y zona ------------------------------
ALTER TABLE equipos ADD COLUMN IF NOT EXISTS ahorafutbol_id INTEGER;
ALTER TABLE equipos ADD COLUMN IF NOT EXISTS zona VARCHAR(10);

UPDATE equipos e
SET ahorafutbol_id = COALESCE(e.ahorafutbol_id, m.club),
    zona           = COALESCE(e.zona, m.zona)
FROM (VALUES
  ('Villa Diaz Velez', 4, 'A'),
  ('Independiente de San Cayetano', 6, 'A'),
  ('Ministerio', 3, 'A'),
  ('Mataderos', 2, 'A'),
  ('Sportivo San Cayetano', 12, 'A'),
  ('Newbery', 5, 'A'),
  ('Villa del Parque', 13, 'A'),
  ('Rivadavia', 9, 'A'),
  ('Estación Quequén', 1, 'B'),
  ('Independiente de Lobería', 10, 'B'),
  ('Gimnasia y Esgrima', 11, 'B'),
  ('Nicanor Olivera', 14, 'B'),
  ('Huracán de Necochea', 8, 'B'),
  ('Defensores de Juan N. Fernández', 16, 'B'),
  ('Del Valle', 17, 'B'),
  ('Defensores de P.Q', 15, 'B')
) AS m(nombre, club, zona)
WHERE e.nombre_equipo = m.nombre
  AND e.liga_id = '1b8540e8-4276-4f9b-a502-a045e216c942';

CREATE UNIQUE INDEX IF NOT EXISTS equipos_liga_ahorafutbol_idx
  ON equipos (liga_id, ahorafutbol_id) WHERE ahorafutbol_id IS NOT NULL;

-- 3. Partidos: número de partido en el sitio (para no duplicar al importar) ---
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS ahorafutbol_id INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS partidos_ahorafutbol_idx
  ON partidos (ahorafutbol_id) WHERE ahorafutbol_id IS NOT NULL;

-- 4. Goleadores -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS goleadores (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    liga_id     UUID NOT NULL REFERENCES ligas(id) ON DELETE CASCADE,
    equipo_id   UUID REFERENCES equipos(id) ON DELETE SET NULL,
    nombre      TEXT NOT NULL CHECK (length(trim(nombre)) BETWEEN 2 AND 80),
    goles       INTEGER NOT NULL DEFAULT 0 CHECK (goles >= 0),
    actualizado TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS goleadores_liga_idx ON goleadores (liga_id, goles DESC);

-- Lectura y escritura solo por el servidor (service role): RLS sin políticas.
ALTER TABLE goleadores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON goleadores FROM anon, authenticated;

-- Comprobación: los 16 equipos con número y zona (ninguno vacío).
SELECT nombre_equipo, ahorafutbol_id, zona FROM equipos
WHERE liga_id = '1b8540e8-4276-4f9b-a502-a045e216c942'
ORDER BY zona, nombre_equipo;
