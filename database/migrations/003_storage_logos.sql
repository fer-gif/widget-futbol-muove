-- ============================================================================
-- 003 · Bucket "club-logos": quitar escritura pública
-- ----------------------------------------------------------------------------
-- Las subidas ahora pasan por /api/admin/upload (service role). El bucket puede
-- seguir siendo PÚBLICO para lectura: eso no depende de estas políticas.
--
-- Primero revisá qué políticas existen:
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects';

-- Después borrá las que permiten INSERT / UPDATE / DELETE sobre club-logos.
-- Si el SQL Editor responde "must be owner of table objects", hacelo desde
-- Dashboard → Storage → Policies (borrar las de INSERT/UPDATE/DELETE del bucket).
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      AND (COALESCE(qual, '') || COALESCE(with_check, '')) ILIKE '%club-logos%'
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', r.policyname);
  END LOOP;
END $$;
