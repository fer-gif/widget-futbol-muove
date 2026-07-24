-- Script de creación de tablas para Widget de Fútbol y Prode (Muove)
-- Base de datos: PostgreSQL (Supabase)

-- 1. Clientes (Diarios / Medios)
CREATE TABLE IF NOT EXISTS clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_medio VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    estado VARCHAR(50) DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'periodo_prueba')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Ligas (Torneos locales y profesionales)
CREATE TABLE IF NOT EXISTS ligas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL, -- NULL si es liga profesional global
    nombre_liga VARCHAR(255) NOT NULL,
    es_profesional BOOLEAN DEFAULT FALSE NOT NULL,
    api_liga_id INTEGER UNIQUE, -- ID en la API de fútbol profesional
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Clientes <-> Ligas (Suscripciones / Asignaciones)
CREATE TABLE IF NOT EXISTS clientes_ligas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE NOT NULL,
    liga_id UUID REFERENCES ligas(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(cliente_id, liga_id)
);

-- 4. Equipos
CREATE TABLE IF NOT EXISTS equipos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    liga_id UUID REFERENCES ligas(id) ON DELETE CASCADE NOT NULL,
    nombre_equipo VARCHAR(255) NOT NULL,
    logo_url TEXT, -- Link a Supabase Storage / CDN
    es_profesional BOOLEAN DEFAULT FALSE NOT NULL,
    api_equipo_id INTEGER UNIQUE, -- ID en la API de fútbol profesional
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Partidos
CREATE TABLE IF NOT EXISTS partidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    liga_id UUID REFERENCES ligas(id) ON DELETE CASCADE NOT NULL,
    cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
    equipo_local_id UUID REFERENCES equipos(id) ON DELETE CASCADE NOT NULL,
    equipo_visitante_id UUID REFERENCES equipos(id) ON DELETE CASCADE NOT NULL,
    goles_local INTEGER DEFAULT 0 NOT NULL,
    goles_visitante INTEGER DEFAULT 0 NOT NULL,
    estado_partido VARCHAR(50) DEFAULT 'programado' CHECK (estado_partido IN ('programado', 'en_vivo', 'finalizado', 'demorado', 'suspendido')),
    fecha_hora TIMESTAMP WITH TIME ZONE NOT NULL,
    minuto_actual INTEGER,
    jornada VARCHAR(100), -- Ronda/Fecha de fútbol (ej. Fecha 10)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Configuración de Widgets
CREATE TABLE IF NOT EXISTS configuracion_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE NOT NULL,
    liga_id UUID REFERENCES ligas(id) ON DELETE CASCADE, -- NULL si es configuración global
    color_primario VARCHAR(7) DEFAULT '#121214' NOT NULL,
    color_secundario VARCHAR(7) DEFAULT '#00E676' NOT NULL,
    logo_medio_url TEXT,
    mostrar_escudos BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(cliente_id, liga_id)
);

-- ============================================================================
-- MÓDULO PRODE (PRONÓSTICOS DEPORTIVOS + LIGAS PRIVADAS DE AMIGOS)
-- ============================================================================

-- 7. Participantes del Prode
CREATE TABLE IF NOT EXISTS prode_participantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    pin_hash VARCHAR(255) NOT NULL, -- PIN de 4 dígitos (encriptado / hash)
    puntos_totales INTEGER DEFAULT 0 NOT NULL,
    racha_actual INTEGER DEFAULT 0 NOT NULL, -- Racha de aciertos seguidos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(cliente_id, email) -- Un email es único por diario
);

-- 8. Pronósticos por Partido
CREATE TABLE IF NOT EXISTS prode_pronosticos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participante_id UUID REFERENCES prode_participantes(id) ON DELETE CASCADE NOT NULL,
    partido_id UUID REFERENCES partidos(id) ON DELETE CASCADE NOT NULL,
    goles_local_pred INTEGER NOT NULL,
    goles_visitante_pred INTEGER NOT NULL,
    puntos_obtenidos INTEGER DEFAULT 0, -- NULL o valor una vez finalizado
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(participante_id, partido_id) -- Un participante pronostica 1 vez por partido
);

-- 9. Ligas Privadas de Amigos
CREATE TABLE IF NOT EXISTS prode_ligas_privadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE NOT NULL,
    creador_id UUID REFERENCES prode_participantes(id) ON DELETE CASCADE NOT NULL,
    nombre_grupo VARCHAR(255) NOT NULL,
    codigo_invitacion VARCHAR(10) NOT NULL UNIQUE, -- Ej: ASADO26
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. Miembros de Ligas Privadas
CREATE TABLE IF NOT EXISTS prode_miembros_liga (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    liga_privada_id UUID REFERENCES prode_ligas_privadas(id) ON DELETE CASCADE NOT NULL,
    participante_id UUID REFERENCES prode_participantes(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(liga_privada_id, participante_id)
);

-- ============================================================================
-- FUNCIÓN AUTOMÁTICA DE CÁLCULO DE PUNTOS PRODE
-- ============================================================================

CREATE OR REPLACE FUNCTION calcular_puntos_prode()
RETURNS TRIGGER AS $$
DECLARE
    rec RECORD;
    pts INTEGER;
    tendencia_real INTEGER; -- 1: local, 0: empate, -1: visitante
    tendencia_pred INTEGER;
BEGIN
    -- Solo calcular cuando el partido pase a estado 'finalizado'
    IF NEW.estado_partido = 'finalizado' AND (OLD.estado_partido IS NULL OR OLD.estado_partido != 'finalizado') THEN
        
        -- Determinar tendencia real del partido
        IF NEW.goles_local > NEW.goles_visitante THEN
            tendencia_real := 1;
        ELSIF NEW.goles_local < NEW.goles_visitante THEN
            tendencia_real := -1;
        ELSE
            tendencia_real := 0;
        END IF;

        -- Iterar todos los pronósticos de este partido
        FOR rec IN SELECT * FROM prode_pronosticos WHERE partido_id = NEW.id LOOP
            pts := 0;

            -- Determinar tendencia pronosticada
            IF rec.goles_local_pred > rec.goles_visitante_pred THEN
                tendencia_pred := 1;
            ELSIF rec.goles_local_pred < rec.goles_visitante_pred THEN
                tendencia_pred := -1;
            ELSE
                tendencia_pred := 0;
            END IF;

            -- Regla A: Resultado Exacto (3 Puntos)
            IF rec.goles_local_pred = NEW.goles_local AND rec.goles_visitante_pred = NEW.goles_visitante THEN
                pts := 3;
            -- Regla B: Tendencia / Ganador o Empate (1 Punto)
            ELSIF tendencia_pred = tendencia_real THEN
                pts := 1;
            ELSE
                pts := 0;
            END IF;

            -- Actualizar puntos obtenidos en el pronóstico
            UPDATE prode_pronosticos 
            SET puntos_obtenidos = pts 
            WHERE id = rec.id;

            -- Sumar los puntos al total acumulado del participante
            UPDATE prode_participantes 
            SET puntos_totales = puntos_totales + pts 
            WHERE id = rec.participante_id;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger que ejecuta el cálculo automático al actualizar partidos
DROP TRIGGER IF EXISTS trigger_calcular_puntos_prode ON partidos;
CREATE TRIGGER trigger_calcular_puntos_prode
AFTER UPDATE ON partidos
FOR EACH ROW
EXECUTE FUNCTION calcular_puntos_prode();
