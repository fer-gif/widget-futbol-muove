-- ============================================================================
-- 002 · Cierre de permisos (RLS)
-- ----------------------------------------------------------------------------
-- CORRER SOLO DESPUÉS de:
--   1. Haber cargado SUPABASE_SERVICE_ROLE_KEY, AUTH_SECRET y SUPER_ADMIN_PASSWORD
--      en Vercel (y en .env.local).
--   2. Haber desplegado el código nuevo.
--   3. Haber iniciado sesión una vez en /super-admin (migra las claves a hash).
--
-- Desde acá, la clave pública (anon) que viaja en el navegador SOLO puede LEER
-- ligas, equipos, partidos y tablas de posiciones, más id/nombre/estado de los
-- clientes. Todo lo demás pasa por el servidor, que valida la sesión.
-- ============================================================================

-- 1. Borrar TODAS las políticas existentes (incluidas las "FOR ALL USING (true)") --
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'noticias', 'clientes', 'ligas', 'clientes_ligas', 'equipos', 'partidos',
        'configuracion_widgets', 'prode_participantes', 'prode_pronosticos',
        'prode_ligas_privadas', 'prode_miembros_liga', 'tablas_posiciones', 'auth_intentos'
      )
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- 2. RLS activado en todas las tablas (las que existan) ------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'noticias', 'clientes', 'ligas', 'clientes_ligas', 'equipos', 'partidos',
    'configuracion_widgets', 'prode_participantes', 'prode_pronosticos',
    'prode_ligas_privadas', 'prode_miembros_liga', 'tablas_posiciones', 'auth_intentos'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- 3. Lectura pública solo de datos deportivos ----------------------------------
CREATE POLICY "lectura_publica" ON ligas    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "lectura_publica" ON equipos  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "lectura_publica" ON partidos FOR SELECT TO anon, authenticated USING (true);

DO $$
BEGIN
  IF to_regclass('public.tablas_posiciones') IS NOT NULL THEN
    CREATE POLICY "lectura_publica" ON tablas_posiciones FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

-- Clientes: filas visibles, pero SOLO las columnas id, nombre_medio y estado
-- (email, ciudad y claves quedan ocultos).
CREATE POLICY "lectura_publica" ON clientes FOR SELECT TO anon, authenticated USING (true);
REVOKE SELECT ON clientes FROM anon, authenticated;
GRANT SELECT (id, nombre_medio, estado) ON clientes TO anon, authenticated;

-- Sin políticas (solo servidor): clientes_ligas, configuracion_widgets, noticias,
-- prode_participantes, prode_pronosticos, prode_ligas_privadas,
-- prode_miembros_liga, auth_intentos.

-- 4. Doble seguro: la clave pública no puede escribir en ninguna tabla ----------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- ============================================================================
-- Verificación (debería listar solo las 4–5 políticas "lectura_publica"):
--   SELECT tablename, policyname, cmd, roles FROM pg_policies WHERE schemaname = 'public';
-- ============================================================================
