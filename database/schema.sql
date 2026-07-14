-- Script de creación de tablas para Widget de Fútbol (Muove)
-- Base de datos: PostgreSQL (Supabase)

-- 1. Clientes
CREATE TABLE IF NOT EXISTS clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_medio VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    estado VARCHAR(50) DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'periodo_prueba')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Ligas
CREATE TABLE IF NOT EXISTS ligas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL, -- NULL si es liga profesional global
    nombre_liga VARCHAR(255) NOT NULL,
    es_profesional BOOLEAN DEFAULT FALSE NOT NULL,
    api_liga_id INTEGER UNIQUE, -- ID en la API de fútbol profesional
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Equipos
CREATE TABLE IF NOT EXISTS equipos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    liga_id UUID REFERENCES ligas(id) ON DELETE CASCADE NOT NULL,
    nombre_equipo VARCHAR(255) NOT NULL,
    logo_url TEXT, -- Link a Supabase Storage
    es_profesional BOOLEAN DEFAULT FALSE NOT NULL,
    api_equipo_id INTEGER UNIQUE, -- ID en la API de fútbol profesional
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Partidos
CREATE TABLE IF NOT EXISTS partidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    liga_id UUID REFERENCES ligas(id) ON DELETE CASCADE NOT NULL,
    equipo_local_id UUID REFERENCES equipos(id) ON DELETE CASCADE NOT NULL,
    equipo_visitante_id UUID REFERENCES equipos(id) ON DELETE CASCADE NOT NULL,
    goles_local INTEGER DEFAULT 0 NOT NULL,
    goles_visitante INTEGER DEFAULT 0 NOT NULL,
    estado_partido VARCHAR(50) DEFAULT 'programado' CHECK (estado_partido IN ('programado', 'en_vivo', 'finalizado')),
    fecha_hora TIMESTAMP WITH TIME ZONE NOT NULL,
    minuto_actual INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Configuración de Widgets
CREATE TABLE IF NOT EXISTS configuracion_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE NOT NULL,
    liga_id UUID REFERENCES ligas(id) ON DELETE CASCADE, -- NULL si es configuración global de colores del cliente
    color_primario VARCHAR(7) DEFAULT '#121214' NOT NULL, -- Hexadecimal (ej. #121214)
    color_secundario VARCHAR(7) DEFAULT '#00E676' NOT NULL, -- Acento Muove (ej. verde neón)
    logo_medio_url TEXT, -- Logo del sponsor / diario
    mostrar_escudos BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(cliente_id, liga_id) -- Un cliente tiene una configuración única por liga (o una global si liga_id es NULL)
);
