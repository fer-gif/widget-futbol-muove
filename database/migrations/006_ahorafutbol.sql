-- ============================================================================
-- 006 · Datos automáticos desde ahorafutbol.ar
-- ----------------------------------------------------------------------------
-- Aditiva. Correr en Supabase → SQL Editor. Se puede correr más de una vez.
-- Sin esta migración las posiciones y goleadores igual se leen del sitio, pero
-- los equipos se emparejan por nombre (algunos quedan sin escudo) y no hay copia
-- de respaldo si el sitio se cae.
-- ============================================================================

-- 1. Equivalencias: número de club y de liga en ahorafutbol.ar ------------------
ALTER TABLE ligas   ADD COLUMN IF NOT EXISTS ahorafutbol_id INTEGER;
ALTER TABLE equipos ADD COLUMN IF NOT EXISTS ahorafutbol_id INTEGER;

-- Liga Necochea 1ra. División Masculino = ligas.php?i=1
UPDATE ligas SET ahorafutbol_id = 1
WHERE id = '1b8540e8-4276-4f9b-a502-a045e216c942' AND ahorafutbol_id IS NULL;

-- Clubes (número de club.php?i=N en el sitio)
UPDATE equipos e
SET ahorafutbol_id = m.club
FROM (VALUES
  ('Estación Quequén', 1),
  ('Mataderos', 2),
  ('Ministerio', 3),
  ('Villa Diaz Velez', 4),
  ('Newbery', 5),
  ('Independiente de San Cayetano', 6),
  ('Huracán de Necochea', 8),
  ('Rivadavia', 9),
  ('Independiente de Lobería', 10),
  ('Gimnasia y Esgrima', 11),
  ('Sportivo San Cayetano', 12),
  ('Villa del Parque', 13),
  ('Nicanor Olivera', 14),
  ('Defensores de P.Q', 15),
  ('Defensores de Juan N. Fernández', 16),
  ('Del Valle', 17)
) AS m(nombre, club)
WHERE e.nombre_equipo = m.nombre
  AND e.liga_id = '1b8540e8-4276-4f9b-a502-a045e216c942'
  AND e.ahorafutbol_id IS NULL;

-- Partidos: número de partido.php?i=N, para no duplicar al sincronizar.
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS ahorafutbol_id INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS partidos_ahorafutbol_idx
  ON partidos (ahorafutbol_id) WHERE ahorafutbol_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS equipos_liga_ahorafutbol_idx
  ON equipos (liga_id, ahorafutbol_id) WHERE ahorafutbol_id IS NOT NULL;

-- 2. Copia de respaldo de lo último leído del sitio -----------------------------
CREATE TABLE IF NOT EXISTS fuente_externa_cache (
    clave       TEXT PRIMARY KEY,
    datos       JSONB NOT NULL,
    actualizado TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Solo el servidor (service role) la usa: RLS activo y sin políticas públicas.
ALTER TABLE fuente_externa_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON fuente_externa_cache FROM anon, authenticated;

-- Comprobación: tienen que aparecer los 16 equipos con su número.
SELECT nombre_equipo, ahorafutbol_id FROM equipos
WHERE liga_id = '1b8540e8-4276-4f9b-a502-a045e216c942'
ORDER BY ahorafutbol_id NULLS FIRST;
