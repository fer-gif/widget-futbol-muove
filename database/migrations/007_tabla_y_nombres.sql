-- ============================================================================
-- 007 · Nombres cortos, descuentos de puntos y cupos de clasificación
-- ----------------------------------------------------------------------------
-- Aditiva. Correr en Supabase → SQL Editor después de la 006. Se puede correr
-- más de una vez. Todo se edita después desde el super-admin (Ligas y equipos →
-- Tabla de posiciones).
-- ============================================================================

-- 1. Equipos ------------------------------------------------------------------
-- Nombre para lugares chicos (tarjetas y tabla del widget). Vacío = el nombre completo.
ALTER TABLE equipos ADD COLUMN IF NOT EXISTS nombre_corto VARCHAR(24);
-- Puntos que suma o resta la liga por fuera de los partidos (sanciones, etc.).
ALTER TABLE equipos ADD COLUMN IF NOT EXISTS ajuste_puntos INTEGER NOT NULL DEFAULT 0;
ALTER TABLE equipos ADD COLUMN IF NOT EXISTS ajuste_motivo VARCHAR(120);

UPDATE equipos e
SET nombre_corto = m.corto
FROM (VALUES
  ('Villa Diaz Velez', 'V. Díaz Vélez'),
  ('Independiente de San Cayetano', 'Ind. San Cayetano'),
  ('Ministerio', 'Ministerio'),
  ('Mataderos', 'Mataderos'),
  ('Sportivo San Cayetano', 'Sp. San Cayetano'),
  ('Newbery', 'Newbery'),
  ('Villa del Parque', 'Villa del Parque'),
  ('Rivadavia', 'Rivadavia'),
  ('Estación Quequén', 'Est. Quequén'),
  ('Independiente de Lobería', 'Ind. Lobería'),
  ('Gimnasia y Esgrima', 'Gimnasia'),
  ('Nicanor Olivera', 'Nicanor Olivera'),
  ('Huracán de Necochea', 'Huracán'),
  ('Defensores de Juan N. Fernández', 'Def. J. N. Fernández'),
  ('Del Valle', 'Del Valle'),
  ('Defensores de P.Q', 'Def. de P.Q.')
) AS m(nombre, corto)
WHERE e.nombre_equipo = m.nombre
  AND e.liga_id = '1b8540e8-4276-4f9b-a502-a045e216c942'
  AND e.nombre_corto IS NULL;

-- 2. Ligas: cuántos equipos de cada zona clasifican (NULL = no marcar) --------
ALTER TABLE ligas ADD COLUMN IF NOT EXISTS clasifican SMALLINT CHECK (clasifican IS NULL OR clasifican BETWEEN 1 AND 40);

UPDATE ligas SET clasifican = COALESCE(clasifican, 4)
WHERE id = '1b8540e8-4276-4f9b-a502-a045e216c942';

-- Comprobación
SELECT nombre_equipo, nombre_corto, zona, ajuste_puntos FROM equipos
WHERE liga_id = '1b8540e8-4276-4f9b-a502-a045e216c942'
ORDER BY zona, nombre_equipo;
