# Guía de despliegue: mejoras del widget (fases 1 a 3)

Pasos para publicar en producción los cambios de la rama `mejoras-widget`:
seguridad, widget nuevo, panel en vivo, métricas y datos automáticos desde
ahorafutbol.ar.

**El orden importa.** Las migraciones 001, 004, 005 y 006 solo agregan cosas y se
pueden correr con el código actual. La 002 cierra los permisos de la base y
**rompe el código viejo**: va al final, cuando el código nuevo ya está publicado
y probado.

| Paso | Dónde | ¿Se puede deshacer? |
|---|---|---|
| 1. Migraciones 001, 004, 005 y 006 | Supabase → SQL Editor | No hace falta: el código actual las ignora |
| 2. Variables de entorno | Vercel → Settings → Environment Variables | Sí |
| 3. Publicar el código | GitHub (`main`) → Vercel | Sí, con "Instant Rollback" en Vercel |
| 4. Entrar una vez al super-admin | `/super-admin` | No hace falta |
| 5. Migración 002 (cerrar permisos) | Supabase → SQL Editor | Ver "Si algo falla" |
| 6. Migración 003 (logos) | Supabase → SQL Editor o Storage | Sí |
| 7. Traer el fixture del año | `/super-admin` → Fixture (Partidos) | Parcial: ver el paso 7 |

---

## Antes de empezar

- Si el plan de Supabase tiene backups, confirmá que haya uno de hoy
  (Database → Backups).
- Elegí un horario sin partidos en juego: entre el paso 3 y el 5 los
  periodistas tienen que volver a iniciar sesión.

## 1. Migraciones que solo agregan (001, 004, 005, 006)

En Supabase → SQL Editor, pegá y ejecutá cada archivo **en este orden**:

1. [`database/migrations/001_config_claves_intentos.sql`](database/migrations/001_config_claves_intentos.sql):
   pasa la configuración visual a una columna `config` y crea la tabla de
   intentos de login.
2. [`database/migrations/004_reloj_y_pestanas.sql`](database/migrations/004_reloj_y_pestanas.sql):
   agrega el reloj del partido y activa las pestañas Posiciones y Goleadores.
3. [`database/migrations/005_metricas.sql`](database/migrations/005_metricas.sql):
   crea la tabla de métricas y la función que las suma.
4. [`database/migrations/006_ahorafutbol.sql`](database/migrations/006_ahorafutbol.sql):
   vincula ligas, equipos y partidos con su número en ahorafutbol.ar y crea la
   copia de respaldo de posiciones y goleadores. Al final muestra los 16
   equipos de la Liga Necochea con su número: no tiene que quedar ninguno vacío.

Las cuatro se pueden correr más de una vez sin problema.

**Comprobación:** esta consulta tiene que mostrar colores y fuentes de cada medio
(no `{}` vacío):

```sql
SELECT cliente_id, config FROM configuracion_widgets;
```

## 2. Variables de entorno en Vercel

En Vercel → proyecto → Settings → Environment Variables, cargá estas variables
para **Production** (y para Preview, si usás deploys de prueba):

| Variable | Valor | Obligatoria |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role`. **Nunca** con prefijo `NEXT_PUBLIC_`. | Sí |
| `AUTH_SECRET` | Texto aleatorio de 32 caracteres o más (comando abajo). | Sí |
| `SUPER_ADMIN_PASSWORD` | La contraseña nueva del `/super-admin`. | Sí |
| `DEFAULT_WIDGET_CLIENT_ID` | `a4dfe7cb-4014-4ee9-a1f0-c5cddeca5dc3` (DataeNe): el medio que se muestra cuando un embed no trae `client-id`. | Recomendada |
| `NEXT_PUBLIC_APP_URL` | `https://widget-futbol-muove.vercel.app` (o el dominio propio). | Recomendada |
| `CRON_SECRET` | Solo si un cron externo va a llamar a `/api/sync/live`. | No |

Para generar `AUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Las mismas variables van en `web/.env.local` para trabajar en tu máquina. La
plantilla está en `web/.env.local.example`.

> Si cambiás `AUTH_SECRET` más adelante, se cierran todas las sesiones abiertas
> (admin, periodistas y Prode). No se pierden datos.

## 3. Publicar el código

Uní la rama a `main` y subila:

```bash
git checkout main
git merge mejoras-widget
git push origin main
```

Esperá a que Vercel termine el deploy y pase a "Ready".

**Comprobaciones (todavía con la base abierta):**

- [ ] Un sitio de un medio que tenga el widget lo muestra con partidos y escudos.
- [ ] `/super-admin` pide contraseña y entra con `SUPER_ADMIN_PASSWORD`.

## 4. Entrar una vez al super-admin

El primer ingreso a `/super-admin` convierte las claves de los periodistas a
formato cifrado. Hace falta antes del paso 5. Ya lo hiciste en la comprobación
anterior; si no, entrá ahora.

**Comprobaciones:**

- [ ] En la pestaña Clientes, cada medio con clave figura como "Configurada ✓".
- [ ] `/admin`: un periodista entra eligiendo su medio y su clave de siempre.
- [ ] `/admin`: cambiar un resultado de prueba se refleja en el widget en menos
      de un minuto. Después dejalo como estaba.
- [ ] `/prode`: un participante inicia sesión con su email y PIN.
- [ ] `/super-admin` → Clientes: subir un logo funciona.

Si algo de esta lista falla, **no sigas con el paso 5**: el código viejo todavía
funciona y podés volver atrás con Instant Rollback en Vercel.

## 5. Cerrar los permisos (002)

Ejecutá [`database/migrations/002_lockdown_rls.sql`](database/migrations/002_lockdown_rls.sql)
en el SQL Editor.

Desde este momento, la clave pública que viaja en el navegador solo puede
**leer** ligas, equipos, partidos y posiciones. Todo lo que escribe pasa por el
servidor, que valida la sesión.

**Comprobaciones:** repetí la lista del paso 4. Agregá esta:

- [ ] El widget sigue mostrando los partidos en un sitio de un medio.

## 6. Logos (003)

Ejecutá [`database/migrations/003_storage_logos.sql`](database/migrations/003_storage_logos.sql).
Primero muestra las políticas del bucket `club-logos` y después borra las que
permiten escribir.

Si Supabase responde `must be owner of table objects`, hacelo a mano: Storage →
Policies → bucket `club-logos` → borrá las políticas de INSERT, UPDATE y DELETE.
**No borres la de lectura**: el widget la usa para mostrar los escudos.

**Comprobación:** subir un logo desde `/super-admin` sigue funcionando (va por
el servidor), y los escudos se siguen viendo en el widget.

## 7. Traer el fixture del año desde ahorafutbol.ar

Desde el deploy, el sistema trae solo los partidos de los últimos y próximos 21
días cada 10 minutos. Las posiciones y los goleadores ya salen del sitio, sin
hacer nada. Lo que falta es completar el historial del torneo: hoy la base
llega hasta la fecha 15 y le faltan partidos.

1. En `/super-admin` → Fixture (Partidos) → "🔄 Fixture y resultados desde
   ahorafutbol.ar", tocá **Simular año completo**. No guarda nada. Según la
   prueba del 4/11, tiene que dar unos 168 partidos en el sitio, unos 138
   nuevos y unos 30 vinculados con los cargados a mano, sin omitidos.
2. Si hay omitidos por "No encuentro el equipo", falta la migración 006 o un
   equipo tiene otro nombre en la base. No sigas hasta resolverlo.
3. Tocá **Traer año completo**. Tarda entre 30 y 60 segundos.
4. Abrí "partidos cargados a mano que el sitio no tiene". En la prueba eran 5
   (cuatro del 11 y 12 de julio sin número de fecha y Villa Díaz Vélez vs
   Defensores de P.Q de la fecha 14). Revisalos en la lista de partidos y
   borralos si sobran. No se borran solos porque pueden tener pronósticos del
   Prode.

**Para deshacerlo:** los partidos traídos tienen `ahorafutbol_id`. Los nuevos se
pueden borrar con
`DELETE FROM partidos WHERE ahorafutbol_id IS NOT NULL AND created_at > '<fecha y hora del paso 3>';`.
Los cambios en partidos que ya existían (horario real, resultado del sitio) no
se revierten solos.

**Comprobaciones:**

- [ ] En `/prode` aparecen las fechas 16 a 21 con sus resultados.
- [ ] Las pestañas Posiciones y Goleadores muestran los datos del sitio, con
      escudo en los 16 equipos y la leyenda "Datos: ahorafutbol.ar".

---

## Qué cambia para cada persona

- **Vos (super-admin):** `/super-admin` pide la contraseña de
  `SUPER_ADMIN_PASSWORD`. La sesión dura 12 horas.
- **Periodistas:** en `/admin` eligen su medio y escriben su clave de siempre.
  Desde el panel tienen el botón "🔴 Modo En Vivo (celular)" para cargar goles
  desde la cancha. Después de 5 claves incorrectas se bloquea 15 minutos.
- **Participantes del Prode:** tienen que iniciar sesión una vez más; el sitio
  se lo pide solo. Si alguien olvidó el PIN, ya no se puede cambiar desde el
  Prode: se le asigna uno nuevo desde la lista de participantes (botón 🔑).
- **Medios:** no tienen que cambiar nada. El código que ya pegaron sigue
  funcionando. Para sumar pestañas, tema o filtro de ligas, generá el código
  nuevo en `/super-admin` → Código para insertar.

## Si algo falla

- **Entre los pasos 3 y 4:** Vercel → Deployments → elegí el deploy anterior →
  "Instant Rollback". Las migraciones 001, 004, 005 y 006 no afectan al código viejo.
- **Después del paso 5:** no vuelvas al código viejo, porque necesita la base
  abierta. Revisá primero que las variables del paso 2 estén cargadas en
  Production y que el deploy sea posterior a cargarlas. Vercel no aplica
  variables nuevas a un deploy ya hecho: hay que hacer "Redeploy".
- **El widget dice "Cliente no encontrado. Revisá el client-id.":** el embed
  trae un `client-id` que no existe. Copiá el código de nuevo desde
  `/super-admin` → Código para insertar. Si dice "Suscripción suspendida o
  inactiva.", el medio está marcado como inactivo en Clientes.
- **La pestaña Métricas muestra un aviso de migración:** falta correr la 005.
- **Posiciones o Goleadores dicen "No se pudo cargar la tabla":** ahorafutbol.ar
  no responde y todavía no hay copia de respaldo (se guarda la primera vez que
  se lee bien, con la migración 006). En los logs de Vercel aparece
  `[ahorafutbol]` con el motivo. Si dice "¿cambió el formato?", el sitio cambió
  su página y hay que ajustar el lector (`web/src/lib/ahorafutbol.ts`).

## Limitaciones conocidas

- `/api/track` (métricas) es público y no limita la cantidad de eventos por
  visitante. Los números sirven para ver tendencias. Si se van a usar para
  cobrar a sponsors, conviene sumar un control de abuso.
- Los datos dependen de ahorafutbol.ar, que no ofrece una API pública: se leen
  sus páginas. Si cambian el formato, las tablas siguen mostrando la última
  copia guardada, pero dejan de actualizarse hasta ajustar el lector.
  Conviene pedirles permiso y que avisen antes de cambios
  (ahorafutbolok@gmail.com, (2983) 664576).
- El sitio no publica el minuto a minuto: el marcador en vivo sigue dependiendo
  del periodista. Sin periodista, el marcador del sitio llega con hasta 10
  minutos de demora.
- Las zonas se toman de la página de la liga, que no coincide con la página del
  torneo para Ministerio y Gimnasia. Confirmar cuál es la correcta.
