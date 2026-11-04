-- ============================================================================
-- 005 · Métricas del widget (impresiones y clics, por medio y por día)
-- ----------------------------------------------------------------------------
-- Aditiva. Correr en Supabase → SQL Editor.
-- Solo el servidor (service role) lee y escribe: sin políticas RLS públicas.
-- ============================================================================

CREATE TABLE IF NOT EXISTS widget_metricas (
    cliente_id    UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    fecha         DATE NOT NULL,                  -- día en hora argentina
    impresiones   INTEGER NOT NULL DEFAULT 0,     -- widget visible al menos 50% en pantalla
    clics_sponsor INTEGER NOT NULL DEFAULT 0,     -- clics en el logo del sponsor
    clics_prode   INTEGER NOT NULL DEFAULT 0,     -- clics en el banner del Prode
    interacciones INTEGER NOT NULL DEFAULT 0,     -- uso de pestañas, filtros o flechas (1 por visita)
    PRIMARY KEY (cliente_id, fecha)
);

ALTER TABLE widget_metricas ENABLE ROW LEVEL SECURITY;

-- Suma 1 de forma atómica (sin carreras entre visitas simultáneas).
CREATE OR REPLACE FUNCTION incrementar_metrica(p_cliente UUID, p_campo TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hoy DATE := (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
BEGIN
  IF p_campo NOT IN ('impresiones', 'clics_sponsor', 'clics_prode', 'interacciones') THEN
    RAISE EXCEPTION 'Campo de métrica inválido: %', p_campo;
  END IF;

  EXECUTE format(
    'INSERT INTO widget_metricas (cliente_id, fecha, %1$I) VALUES ($1, $2, 1)
     ON CONFLICT (cliente_id, fecha) DO UPDATE SET %1$I = widget_metricas.%1$I + 1',
    p_campo
  ) USING p_cliente, hoy;
END;
$$;

-- Solo el servidor puede llamarla (la clave pública no).
REVOKE EXECUTE ON FUNCTION incrementar_metrica(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION incrementar_metrica(UUID, TEXT) TO service_role;
