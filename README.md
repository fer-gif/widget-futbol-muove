# Muove · Widget de Fútbol en Vivo & Prode

Plataforma SaaS multi-cliente de **widgets embebibles de fútbol en vivo**, tabla de posiciones calculada automáticamente, goleadores, carrusel de noticias y **Prode deportivo con ligas privadas**, diseñada para diarios digitales, radios y medios locales.

Permite que cada medio inserte un widget personalizable con una sola etiqueta HTML (`<futbol-widget>`), mientras sus periodistas cargan resultados en vivo desde la cancha y un super-administrador gestiona clientes, estilos, sponsors, ligas, métricas y sincronizaciones.

> Para el paso a paso de puesta en producción, migraciones y rollback, ver [DESPLIEGUE.md](./DESPLIEGUE.md).

---

## Tabla de contenidos

1. [Tecnologías utilizadas](#tecnologías-utilizadas)
2. [Arquitectura general](#arquitectura-general)
3. [Estructura del proyecto](#estructura-del-proyecto)
4. [Cómo funciona cada módulo](#cómo-funciona-cada-módulo)
5. [Modelo de base de datos y migraciones](#modelo-de-base-de-datos-y-migraciones)
6. [Seguridad y autenticación](#seguridad-y-autenticación)
7. [Referencia de rutas y APIs](#referencia-de-rutas-y-apis)
8. [Instalación y desarrollo local](#instalación-y-desarrollo-local)

---

## Tecnologías utilizadas

| Capa | Tecnología | Versión / Detalle | Uso en el proyecto |
| --- | --- | --- | --- |
| **Framework Full-Stack** | **Next.js** (App Router) | `16.2.10` | Páginas SSR/CSR, paneles de administración, embeds y API Routes del backend. |
| **UI / Frontend** | **React** & **React DOM** | `19.2.4` | Interfaces interactivas de `/super-admin`, `/admin`, `/admin/en-vivo`, `/prode`, `/docs` y `/embed/*`. |
| **Lenguaje** | **TypeScript** | `5.x` | Tipado estático en todo el frontend, backend y librerías internas (`web/src`). |
| **Estilos** | **Tailwind CSS** + `@tailwindcss/postcss` | `4.x` | Estilos de todos los paneles administrativos, vistas embebibles y Prode. |
| **Widget embebible** | **Vanilla JavaScript (ES5/ES6)** + **Web Components** (`Custom Elements` + **Shadow DOM**) | Sin dependencias externas | `web/public/widget.js`: se incrusta en cualquier web externa sin conflictos de CSS ni JS. |
| **Base de datos** | **PostgreSQL** gestionado en **Supabase** | `@supabase/supabase-js ^2.110.1` | Persistencia relacional, Row Level Security (RLS), triggers PL/pgSQL y funciones RPC. |
| **Almacenamiento** | **Supabase Storage** | Bucket público `club-logos` | Alojamiento de logos de medios, escudos de clubes y banners de sponsors (subida validada por servidor). |
| **Seguridad / Cripto** | **Node.js `crypto`** (nativo) | HMAC-SHA256, `scrypt`, `timingSafeEqual` | Sesiones firmadas en cookies `HttpOnly`, tokens del Prode y hash seguro de claves y PINs. |
| **Exportación visual** | **`html-to-image`** | `^1.11.13` | Generación y descarga de tarjetas/imágenes PNG de pronósticos en el Prode. |
| **Hosting & CDN** | **Vercel** | Edge CDN + Serverless Functions | Despliegue continuo desde GitHub y caché HTTP (`s-maxage` / `stale-while-revalidate`) para tráfico masivo del widget. |
| **Integraciones externas** | **API-Football (`api-sports.io` v3)** y lector propio de **`ahorafutbol.ar`** | HTTP `fetch` server-side | Importación de ligas profesionales (API-Football) y puesta al día puntual de ligas locales (`ahorafutbol.ar`). |
| **Calidad de código** | **ESLint** (`eslint-config-next`) | `9.x` / `16.2.10` | Linting estático del proyecto Next.js. |

---

## Arquitectura general

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ Sitios de Medios / Diarios (externos)                                   │
│  • <script src=".../widget.js"> + <futbol-widget client-id="...">       │
│    (Web Component con Shadow DOM, polling adaptativo y sendBeacon)      │
│  • Iframes opcionales: /prode, /embed/partidos, /embed/posiciones, etc. │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTPS + CORS + Cache CDN Vercel
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Next.js 16 App Router (Vercel)                                          │
│                                                                         │
│  Páginas / UI:                                                          │
│  • /                 Landing y accesos principales                      │
│  • /super-admin      Panel maestro (clientes, ligas, fixture, métricas) │
│  • /admin            Panel de periodistas por medio                     │
│  • /admin/en-vivo    Modo En Vivo móvil para carga desde la cancha      │
│  • /prode            Juego de pronósticos + ligas privadas              │
│  • /docs             Guía de integración y previsualización             │
│  • /embed/*          Vistas embebibles independientes                   │
│                                                                         │
│  API Routes (Server-side con SUPABASE_SERVICE_ROLE_KEY):                │
│  • /api/widget, /api/prode/standings, /api/goleadores   (lectura + CDN) │
│  • /api/track                                           (métricas)      │
│  • /api/auth/*, /api/admin/*                            (sesión + RBAC) │
│  • /api/prode/*                                         (Prode)         │
│  • /api/news, /api/news/extract                         (noticias OG)   │
│  • /api/sync/*                                          (API-Football / │
│                                                          ahorafutbol)   │
└───────────────┬─────────────────────────────────────┬───────────────────┘
                │                                     │
                ▼                                     ▼
┌────────────────────────────────────┐   ┌────────────────────────────────┐
│ Supabase                           │   │ Fuentes externas (opcionales)  │
│  • PostgreSQL + RLS cerrado        │   │  • ahorafutbol.ar (sync local) │
│  • Trigger: calcular_puntos_prode  │   │  • API-Football v3 (ligas pro) │
│  • RPC: incrementar_metrica        │   └────────────────────────────────┘
│  • Storage: bucket `club-logos`    │
└────────────────────────────────────┘
```

### Principios clave de diseño
- **Multi-tenant por medio (`clientes`):** cada diario tiene su propia suscripción (`activo`, `inactivo`, `periodo_prueba`), estética, sponsor, ligas asignadas, credenciales de periodistas, participantes de Prode y métricas diarias.
- **Seguridad server-side:** la base de datos tiene RLS cerrado para escritura desde el navegador. Todas las escrituras administrativas, subidas de archivos y operaciones del Prode pasan por rutas de servidor que validan sesión o token firmado y operan con `SUPABASE_SERVICE_ROLE_KEY`.
- **Resistencia a picos de tráfico:** los endpoints públicos que consume el widget (`/api/widget`, `/api/prode/standings`, `/api/goleadores`) responden con cabeceras `Cache-Control: public, s-maxage=..., stale-while-revalidate=...` para que el CDN de Vercel absorba la mayoría de las peticiones de los lectores sin sobrecargar PostgreSQL.

---

## Estructura del proyecto

```text
widgetFutbol/
├── DESPLIEGUE.md                        # Guía paso a paso de despliegue y migraciones
├── README.md                            # Documentación completa del proyecto
├── database/
│   ├── schema.sql                       # Esquema base de tablas, trigger Prode y RLS
│   ├── goleadores_data.json             # Datos históricos/respaldo de goleadores
│   └── migrations/
│       ├── 001_config_claves_intentos.sql  # Config JSONB, clave_hash, auth_intentos e índices
│       ├── 002_lockdown_rls.sql            # Cierre de permisos RLS (solo lectura deportiva pública)
│       ├── 003_storage_logos.sql           # Cierre de escritura pública en bucket club-logos
│       ├── 004_reloj_y_pestanas.sql        # Reloj de partido (periodo/periodo_inicio) y pestañas
│       ├── 005_metricas.sql                # Tabla widget_metricas y RPC incrementar_metrica
│       ├── 006_ahorafutbol.sql             # Zonas, torneo_inicio, IDs ahorafutbol y tabla goleadores
│       └── 007_tabla_y_nombres.sql         # nombre_corto, ajuste_puntos/motivo y cupos clasifican
└── web/                                 # Aplicación Next.js
    ├── .env.local.example               # Plantilla de variables de entorno
    ├── package.json                     # Dependencias y scripts
    ├── public/
    │   ├── widget.js                    # Web Component embebible <futbol-widget>
    │   ├── escudos_necochea/            # Escudos locales de los 16 clubes de Liga Necochea
    │   ├── test-widget.html             # Página local de prueba del widget
    │   └── test-prode-iframe.html       # Página local de prueba del Prode en iframe
    └── src/
        ├── app/
        │   ├── page.tsx                 # Portada con accesos a Super-Admin, Periodistas y Docs
        │   ├── super-admin/             # Panel de Super Administrador y subcomponentes
        │   │   ├── page.tsx
        │   │   └── _components/
        │   │       ├── FixtureImport.tsx       # Importador de fixture
        │   │       ├── IntegracionPanel.tsx    # Generador de código HTML embebible
        │   │       ├── NoticiasPanel.tsx       # Gestor de noticias del carrusel
        │   │       ├── SyncAhorafutbol.tsx     # Puesta al día desde ahorafutbol.ar
        │   │       └── TablaConfig.tsx         # Zonas, nombres cortos, sanciones y cupos
        │   ├── admin/
        │   │   ├── page.tsx             # Panel de Periodistas por medio
        │   │   └── en-vivo/page.tsx     # Modo En Vivo móvil para la cancha
        │   ├── prode/page.tsx           # Aplicación completa del Prode
        │   ├── docs/page.tsx            # Documentación e integración visual
        │   ├── embed/                   # Vistas standalone para iframe
        │   │   ├── partidos/page.tsx
        │   │   ├── posiciones/page.tsx
        │   │   └── goleadores/page.tsx
        │   └── api/                     # Endpoints REST del backend
        ├── components/                  # Componentes compartidos (GoleadoresEditor, LoginForm,
        │                                # MetricasPanel, NewsCarousel, ProdeParticipantsManager, Toaster)
        ├── data/noticias.json           # Fallback local de noticias
        └── lib/
            ├── auth.ts                  # HMAC-SHA256, scrypt, cookies, rate-limiting
            ├── db-client.ts             # Cliente frontend hacia /api/admin/db
            ├── match-clock.ts           # Lógica compartida del reloj de partido
            ├── supabase.ts              # Cliente Supabase público (anon key)
            ├── supabase-server.ts       # Cliente Supabase de servidor (service role key)
            ├── widget-config.ts         # Normalización y validación de configuración visual
            ├── ahorafutbol.ts           # Scraper/parser de ahorafutbol.ar (UTF-8/Win-1252)
            └── sync-ahorafutbol.ts      # Sincronización inteligente hacia partidos y goleadores
```

---

## Cómo funciona cada módulo

### 1. Widget embebible (`<futbol-widget>` en `web/public/widget.js`)

Los medios insertan el widget pegando dos líneas en su sitio web:

```html
<script src="https://widget-futbol-muove.vercel.app/widget.js" defer></script>
<futbol-widget client-id="UUID_DEL_MEDIO"></futbol-widget>
```

**Cómo funciona internamente:**
- **Aislamiento total:** usa `Custom Elements` + `Shadow DOM (mode: "open")`, evitando que el CSS del portal cliente rompa el widget o viceversa.
- **Atributos opcionales soportados:** `client-id`, `leagues` (UUIDs separados por coma), `client-name`, `theme` (`oscuro` | `claro` | `auto`), `tabs` (`partidos,posiciones,goleadores`), `sponsor-url`, `prode-url`, `logo-url`, `primary-color`, `secondary-color`, `card-bg-color`, `main-text-color`, `sub-text-color`, `border-color-1`, `border-color-2`, `font-family`. La configuración guardada en el super-admin tiene prioridad sobre los colores.
- **Pestañas:**
  - **Partidos:** carrusel horizontal con autoplay (se pausa al interactuar), ordenando primero partidos **en vivo**, luego **próximos** (más cercanos primero) y al final **resultados** (más recientes primero). Muestra ventana de 10 días atrás a 30 días adelante (con fallback a los últimos 20 si la temporada está parada) y usa `nombre_corto` para mejor lectura en tarjetas.
  - **Posiciones:** consume `/api/prode/standings` con tablas separadas por zona, línea de corte de clasificación, racha de últimos 5 partidos (`G`/`E`/`P`) y notas de descuentos/ajustes de puntos.
  - **Goleadores:** consume `/api/goleadores` mostrando el top 10 expandible a la lista completa.
- **Actualización inteligente en tiempo real:**
  - Si hay partidos en vivo, consulta `/api/widget` cada **20 segundos**; si no, cada **60 segundos**.
  - Un reloj local avanza el minuto cada **15 segundos** sin necesidad de pedir datos al servidor.
  - Todas las fechas y horarios se formatean siempre en hora argentina (`America/Argentina/Buenos_Aires`), sin importar la zona horaria del lector.
- **Métricas integradas:** usa `IntersectionObserver` para contar una **impresión** cuando al menos el 50% del widget entra en pantalla, y envía eventos (`impresion`, `sponsor`, `prode`, `interaccion`) de forma no bloqueante vía `navigator.sendBeacon` a `/api/track`.

### 2. Panel de Super-Administrador (`/super-admin`)

Acceso exclusivo con `SUPER_ADMIN_PASSWORD` (sesión de 12 horas). Al iniciar sesión, además migra automáticamente cualquier clave heredada de periodistas en texto plano a hash `scrypt`.

Cuenta con **8 pestañas**:
1. **Clientes:** alta, edición y suspensión de medios (`activo` / `inactivo` / `periodo_prueba`), configuración visual completa (colores, tema oscuro/claro/auto, tipografía, logo del medio, logo/link de sponsor, activación de pestañas Posiciones/Goleadores y banner del Prode), subida de imágenes a Supabase Storage (`/api/admin/upload`) y asignación de claves de periodistas y ligas habilitadas.
2. **Ligas y Equipos:** gestión de ligas locales y profesionales, carga de equipos y escudos, más el subpanel **Tabla de posiciones** (`TablaConfig.tsx`) donde se define:
   - Fecha de inicio del torneo (`torneo_inicio`).
   - Cantidad de equipos que clasifican por zona (`clasifican`).
   - Por cada equipo: `zona` (`A`, `B`, etc.), `nombre_corto`, `ajuste_puntos` (sanciones o bonificaciones) y `ajuste_motivo`.
3. **Fixture (Partidos):** alta/edición/eliminación de partidos, importación masiva (`FixtureImport.tsx`), sincronización con **API-Football** para ligas profesionales y panel **"Ponerse al día desde ahorafutbol.ar"** (`SyncAhorafutbol.tsx`).
4. **Código para insertar:** generador interactivo (`IntegracionPanel.tsx`) del snippet HTML para copiar y pegar en cada medio, con selector de pestañas, tema y filtro de ligas.
5. **Goleadores:** editor compartido (`GoleadoresEditor.tsx`) para sumar/restar goles o cargar nuevos jugadores por liga y equipo.
6. **Métricas:** tablero (`MetricasPanel.tsx`) con impresiones, clics en sponsor, clics en Prode e interacciones por día y por medio (ventana configurable hasta 365 días).
7. **Noticias:** gestor (`NoticiasPanel.tsx`) para agregar notas pegando una URL (extrae automáticamente título, imagen, descripción y medio vía OpenGraph en `/api/news/extract`), activar/ocultar, reordenar y eliminar.
8. **Participantes del Prode:** listado por medio (`ProdeParticipantsManager.tsx`), consulta de puntajes y restablecimiento seguro de PINs olvidados.

### 3. Panel de Periodistas (`/admin`) y Modo En Vivo (`/admin/en-vivo`)

Los periodistas ingresan eligiendo su medio e introduciendo su clave. Su sesión queda restringida en el servidor únicamente a las ligas asignadas a su medio.

- **Panel de escritorio (`/admin`):** 4 pestañas (**Partidos**, **Goleadores**, **Participantes Prode** y **Métricas** de su propio medio).
- **Modo En Vivo (`/admin/en-vivo`):** interfaz móvil pensada para usar desde la cancha con botones grandes:
  - Muestra los partidos de hoy, los que están en vivo y los que quedaron sin cerrar.
  - Botones directos `+1` / `-1` para goles de local y visitante.
  - Control de reloj con un toque: **Iniciar 1T**, **Entretiempo (ET)**, **Iniciar 2T** y **Finalizar**.
  - Refresco automático cada 30 segundos (pausado cuando la pestaña está en segundo plano) y reloj local cada 10 segundos.

### 4. Reloj de partido (`web/src/lib/match-clock.ts`)

Calcula el estado visible y el minuto con una jerarquía de 3 prioridades (replicada en `widget.js` para avanzar en el cliente):
1. **Reloj oficial del periodista (`periodo` + `periodo_inicio`):** calcula el minuto exacto desde el inicio del `1T` (tope `45+`), muestra `ET` en entretiempo, o desde el inicio del `2T` (base 45, tope `90+`).
2. **Minuto manual (`minuto_actual`):** si se cargó un número a mano.
3. **Estimación por horario (`fecha_hora`):** si un partido `programado` supera su hora de inicio, pasa automáticamente a `en_vivo` estimado (`1'`–`45'`, `ET`, `46'`–`90+`). Pasados **130 minutos** (`LIVE_WINDOW_MIN`) sin que nadie lo cierre, pasa a estado `a_confirmar`.

### 5. Tabla de posiciones calculada (`/api/prode/standings`)

Las posiciones ya no se cargan a mano: se calculan dinámicamente en base a los partidos `finalizado` de la liga:
- Filtra partidos a partir de `ligas.torneo_inicio`.
- Excluye automáticamente rondas eliminatorias (jornadas que contengan `semi`, `final`, `cuarto`, `octavo`, `reducido`, `promoción`, `play-off`, `repechaje` o `desempate`).
- Deduplica partidos cargados por más de un medio el mismo día (dando prioridad al registro global sin `cliente_id`).
- Agrupa por `equipos.zona`, suma 3 pts por victoria / 1 por empate, aplica `ajuste_puntos` (sanciones de liga) y ordena por **Puntos → Diferencia de gol → Goles a favor → Orden alfabético**.
- Calcula además la racha de los últimos 5 partidos (`G`, `E`, `P`) y devuelve la fecha del último partido computado (`hasta`) junto con el cupo de clasificación (`clasifican`).

### 6. Módulo Prode (`/prode`)

Juego de pronósticos deportivos multi-medio (pensado también para incrustarse vía `<iframe>`):
- **Acceso por participante:** registro y login con `email` + **PIN numérico de 4 dígitos** (único por medio). Devuelve un token firmado válido por 60 días. Si un jugador olvida su PIN, ya no puede resetearse públicamente: un periodista o super-admin le asigna uno nuevo desde el panel.
- **Pronósticos:** el usuario carga marcadores exactos antes del inicio de cada partido (`/api/prode/predict`).
- **Puntuación automática en PostgreSQL:** cuando un partido pasa a estado `finalizado`, el trigger `trigger_calcular_puntos_prode` (`calcular_puntos_prode()`) evalúa todos los pronósticos del partido:
  - **3 puntos** por resultado exacto.
  - **1 punto** por acertar ganador o empate (tendencia).
  - **0 puntos** si no acierta.
- **Rankings y Ligas Privadas:** tabla general del medio (`/api/prode/leaderboard`) y grupos de amigos con código de invitación único (`/api/prode/leagues`, ej. `ASADO26`).
- **Compartir en redes:** permite descargar una imagen PNG de los pronósticos/resultados generada en el navegador mediante `html-to-image`.

### 7. Sincronización externa (`ahorafutbol.ar` y `API-Football`)

- **Puesta al día desde `ahorafutbol.ar` (`/api/sync/ahorafutbol`):**
  - Herramienta manual (o ejecutable por cron en modo `reciente`) para importar partidos históricos y goleadores de la Liga Necochea.
  - Incluye un decodificador byte a byte (`decodificarMixto`) que resuelve páginas con mezcla de UTF-8 y Windows-1252.
  - Soporta **Simular** (dry-run sin escribir) y **Ejecutar** en modo `reciente` o `completo`.
  - Vincula partidos ya cargados a mano (por equipos y cercanía de fecha) para evitar duplicados, nunca pisa partidos que un periodista esté siguiendo en vivo y lista partidos locales que no figuran en el sitio (`sinPareja`) para revisión manual.
- **Ligas profesionales con API-Football (`/api/sync/import` y `/api/sync/live`):**
  - Importa equipos (con sus escudos) y fixture completo de una temporada desde `v3.football.api-sports.io`.
  - `/api/sync/live` actualiza los partidos del día para todas las ligas marcadas con `es_profesional = true` y acepta automatización mediante cabecera `Authorization: Bearer <CRON_SECRET>`.

---

## Modelo de base de datos y migraciones

Base de datos **PostgreSQL en Supabase** definida en [database/schema.sql](./database/schema.sql) y evolucionada mediante las migraciones en `database/migrations/`:

### Tablas principales

| Tabla | Propósito | Acceso con clave pública (`anon`) tras migración 002 |
| --- | --- | --- |
| `clientes` | Medios/diarios suscriptos, estado y `clave_hash` de periodistas | Solo lectura de `id`, `nombre_medio`, `estado` |
| `ligas` | Torneos locales y profesionales (`torneo_inicio`, `clasifican`, `api_liga_id`, `ahorafutbol_id`) | Solo lectura |
| `clientes_ligas` | Relación N:M entre medios y ligas asignadas | Solo servidor |
| `equipos` | Clubes por liga (`logo_url`, `zona`, `nombre_corto`, `ajuste_puntos`, `ajuste_motivo`) | Solo lectura |
| `partidos` | Fixture, goles, estado, reloj (`periodo`, `periodo_inicio`, `minuto_actual`) y jornada | Solo lectura |
| `configuracion_widgets` | Colores, tipografía, tema, sponsor, prode y pestañas en columna `config` (`JSONB`) | Solo servidor |
| `goleadores` | Tabla editable de goleadores por liga y equipo | Solo servidor |
| `noticias` | Artículos del carrusel de noticias | Solo servidor |
| `widget_metricas` | Contadores diarios (`impresiones`, `clics_sponsor`, `clics_prode`, `interacciones`) | Solo servidor |
| `auth_intentos` | Control de intentos fallidos y bloqueos temporales de login | Solo servidor |
| `prode_participantes` | Jugadores del Prode por medio, `pin_hash`, puntos y racha | Solo servidor |
| `prode_pronosticos` | Pronósticos por participante y partido + puntos obtenidos | Solo servidor |
| `prode_ligas_privadas` | Grupos de amigos del Prode y códigos de invitación | Solo servidor |
| `prode_miembros_liga` | Membresías de participantes en ligas privadas | Solo servidor |

### Funciones y triggers SQL
- **`calcular_puntos_prode()`** (trigger `AFTER UPDATE ON partidos`): recalcula y suma puntos en `prode_pronosticos` y `prode_participantes` cuando un partido cambia a `finalizado`.
- **`incrementar_metrica(p_cliente, p_campo)`** (`SECURITY DEFINER`, ejecutable solo por `service_role`): realiza un `INSERT ... ON CONFLICT DO UPDATE` atómico por `(cliente_id, fecha)` en hora argentina.

### Orden de migraciones (`database/migrations/`)
1. `001_config_claves_intentos.sql` — Columna `config` JSONB, `clave_hash`, tabla `auth_intentos` e índices de rendimiento.
2. `004_reloj_y_pestanas.sql` — Columnas `periodo` y `periodo_inicio` en `partidos`; activa pestañas de posiciones y goleadores.
3. `005_metricas.sql` — Tabla `widget_metricas` y función RPC `incrementar_metrica`.
4. `006_ahorafutbol.sql` — Campos `ahorafutbol_id`, `torneo_inicio`, `zona` y tabla `goleadores`.
5. `007_tabla_y_nombres.sql` — Campos `nombre_corto`, `ajuste_puntos`, `ajuste_motivo` y `clasifican`.
6. `002_lockdown_rls.sql` — Cierre estricto de políticas RLS y revocación de permisos de escritura a `anon`/`authenticated` *(correr únicamente después de desplegar el código nuevo y loguear en `/super-admin`)*.
7. `003_storage_logos.sql` — Elimina políticas de escritura pública en el bucket `club-logos` de Supabase Storage.

---

## Seguridad y autenticación

- **Proxy autorizado de base de datos (`/api/admin/db`):** los paneles no escriben directamente en Supabase desde el navegador. Envían consultas estructuradas a `/api/admin/db`, que valida sesión, rol, tabla, columnas permitidas y pertenencia de ligas/partidos antes de ejecutar con `service_role`.
- **Sesiones firmadas (`web/src/lib/auth.ts`):**
  - Cookie `muove_session` firmada con **HMAC-SHA256** (`AUTH_SECRET` de al menos 32 caracteres), marcada `HttpOnly`, `SameSite=Lax`, `Secure` en producción y vigencia de **12 horas**.
  - Tokens del Prode firmados con HMAC-SHA256 y vigencia de **60 días**.
- **Hash de contraseñas y PINs:** `scrypt` con sal aleatoria de 16 bytes y comparación en tiempo constante (`crypto.timingSafeEqual`).
- **Protección contra fuerza bruta:** tabla `auth_intentos`; tras **5 intentos fallidos** bloquea por **15 minutos** (por IP en super-admin, por medio+IP en periodistas, por medio+email en Prode).
- **Subida segura de archivos (`/api/admin/upload`):** solo `superadmin`, límite de **3 MB**, validación estricta de MIME (`PNG`, `JPG`, `WEBP`, `GIF`, `SVG`) y carpetas permitidas (`logos`, `sponsors`).
- **Prevención XSS en el widget:** `widget.js` y `widget-config.ts` escapan todo texto antes de renderizar HTML y validan todos los colores hexadecimales y URLs (`http:` / `https:` únicamente).

---

## Referencia de rutas y APIs

### Rutas web (páginas)

| Ruta | Descripción |
| --- | --- |
| `/` | Portada institucional con accesos a los paneles y documentación. |
| `/super-admin` | Panel de administración general (requiere `SUPER_ADMIN_PASSWORD`). |
| `/admin` | Panel de periodistas por medio (requiere clave del medio). |
| `/admin/en-vivo` | Modo En Vivo optimizado para celular en cancha. |
| `/prode` | Juego de Prode embebible o independiente. |
| `/docs` | Documentación de integración y previsualización del widget. |
| `/embed/partidos` | Vista embebible standalone de próximos partidos / en vivo. |
| `/embed/posiciones` | Vista embebible standalone de tabla de posiciones. |
| `/embed/goleadores` | Vista embebible standalone de tabla de goleadores. |

### Endpoints API

| Endpoint | Métodos | Acceso | Función |
| --- | --- | --- | --- |
| `/api/widget` | `GET`, `OPTIONS` | Público (CORS + CDN) | Devuelve configuración visual y partidos ordenados/con reloj para un `client-id`. |
| `/api/prode/standings` | `GET`, `OPTIONS` | Público (CORS + CDN) | Calcula y devuelve la tabla de posiciones por zonas, racha y cupos de clasificación. |
| `/api/goleadores` | `GET`, `OPTIONS` | Público (CORS + CDN) | Devuelve la tabla de goleadores de una liga. |
| `/api/track` | `POST`, `OPTIONS` | Público (`sendBeacon`) | Registra impresiones, clics en sponsor/prode e interacciones del widget. |
| `/api/auth/login` | `POST` | Público (con rate limit) | Inicia sesión de `superadmin` o `periodista` y emite cookie `muove_session`. |
| `/api/auth/logout` | `POST` | Autenticado | Cierra sesión limpiando la cookie. |
| `/api/auth/me` | `GET` | Sesión actual | Devuelve los datos de la sesión vigente. |
| `/api/admin/db` | `POST` | `superadmin` / `periodista` | Proxy CRUD validado por rol contra Supabase. |
| `/api/admin/upload` | `POST` | `superadmin` | Sube logos y sponsors al bucket `club-logos` de Supabase Storage. |
| `/api/admin/metricas` | `GET` | `superadmin` / `periodista` | Consulta métricas diarias del widget (el periodista solo ve su medio). |
| `/api/news` | `GET`, `POST` | `GET` público / `POST` `superadmin` | Lee, crea, reordena, oculta o elimina noticias del carrusel. |
| `/api/news/extract` | `POST` | `superadmin` | Extrae metadatos OpenGraph/Twitter Card de una URL de noticia. |
| `/api/prode/auth` | `POST`, `OPTIONS` | Público (con rate limit) | Registro e inicio de sesión de participantes del Prode (email + PIN). |
| `/api/prode/predict` | `GET`, `POST`, `OPTIONS` | Token Prode para `POST` | Consulta y guarda pronósticos de partidos. |
| `/api/prode/leaderboard` | `GET`, `OPTIONS` | Público | Ranking general o por liga privada del Prode. |
| `/api/prode/leagues` | `GET`, `POST`, `OPTIONS` | Token Prode para `POST` | Crea o une participantes a ligas privadas con código de invitación. |
| `/api/prode/participants` | `GET`, `POST` | `superadmin` / `periodista` | Lista participantes del Prode y permite restablecer PINs olvidados. |
| `/api/sync/ahorafutbol` | `POST` | `superadmin` o `CRON_SECRET` | Simula o importa partidos y goleadores desde `ahorafutbol.ar`. |
| `/api/sync/import` | `GET`, `POST` | `superadmin` | Importa equipos y fixture de ligas profesionales desde API-Football. |
| `/api/sync/live` | `GET`, `POST` | `superadmin` o `CRON_SECRET` | Sincroniza resultados en vivo del día para ligas profesionales vía API-Football. |
| `/api/sync/match` | `GET`, `POST` | `superadmin` | Sincronización puntual de un partido con API-Football. |

---

## Instalación y desarrollo local

### Requisitos
- **Node.js** `20+` (en Vercel corre en `24.x`) y **npm**.
- Un proyecto de **Supabase** con el esquema y migraciones aplicadas.

### 1. Configurar variables de entorno

Copiá `web/.env.local.example` a `web/.env.local` y completá las claves:

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | URL de tu proyecto de Supabase. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sí | Clave pública (`anon`) de Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí | Clave secreta `service_role` de Supabase (**solo servidor**, nunca con prefijo `NEXT_PUBLIC_`). |
| `AUTH_SECRET` | Sí | Cadena aleatoria de al menos 32 caracteres para firmar sesiones y tokens del Prode. |
| `SUPER_ADMIN_PASSWORD` | Sí | Contraseña de acceso al panel `/super-admin`. |
| `DEFAULT_WIDGET_CLIENT_ID` | Recomendada | UUID del cliente por defecto cuando un embed viejo no incluye `client-id`. |
| `NEXT_PUBLIC_APP_URL` | Recomendada | URL pública de la app (ej. `https://widget-futbol-muove.vercel.app`) para resolver rutas de escudos. |
| `API_FOOTBALL_KEY` | Opcional | Clave de `api-sports.io` (solo si sincronizás ligas profesionales). |
| `CRON_SECRET` | Opcional | Secreto Bearer para disparar `/api/sync/live` o `/api/sync/ahorafutbol` desde un cron externo. |

Para generar un `AUTH_SECRET` seguro:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 2. Instalar dependencias y levantar el servidor

```bash
cd web
npm install
npm run dev
```

La aplicación queda disponible en `http://localhost:3000`.

### Scripts disponibles (dentro de `web/`)

```bash
npm run dev    # Servidor de desarrollo con hot-reload
npm run build  # Compilación de producción
npm run start  # Ejecuta el build de producción localmente
npm run lint   # Verifica reglas de ESLint
```

---

## Producción y mantenimiento

El proyecto se despliega en **Vercel** conectado al repositorio de GitHub (directorio raíz de la app Next.js: `web/`). Ante cualquier cambio de variables de entorno en Vercel, es necesario ejecutar un **Redeploy** para que tomen efecto en producción.

Para la checklist completa de migraciones, verificaciones y rollback, consultar [DESPLIEGUE.md](./DESPLIEGUE.md).
