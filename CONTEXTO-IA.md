# CONTEXTO DEL PROYECTO (para IA y colaboradores)

Este documento describe el proyecto de forma integral: arquitectura, entorno, consultas SQL, contratos de la API, lógica de UI y despliegue. No contiene secretos reales; todos los ejemplos de `.env` usan placeholders.

## Índice

1. Arquitectura y stack
2. Estructura de archivos relevante
3. Variables de entorno (`.env.local` y `.env.example`)
4. Conexión a base de datos (`src/lib/db.ts`)
5. API de datos (`src/app/api/dashboard/route.ts`)
   - 5.1 kpiQuery
   - 5.2 seriesQuery
   - 5.3 closerQuery
   - 5.4 eventsQuery
   - 5.5 pendientesQuery
   - 5.6 adsKpisQuery
   - 5.7 callsKpisQuery
   - 5.8 adsByOriginQuery
   - 5.9 Contrato de respuesta
6. Frontend (`src/app/page.tsx`): KPIs, tablas, leaderboard, exportación a Excel
7. Reglas de fechas y normalización de strings
8. Despliegue en Vercel (`DEPLOY.md`)
9. Pruebas manuales y verificación
10. Cambios recientes

---

## 1) Arquitectura y stack

- Framework: Next.js 15 (App Router)
- Lenguaje: TypeScript (estricto)
- Estado de servidor: React Query v5
- Base de datos: PostgreSQL
- Estilos: Tailwind CSS + shadcn/ui
- Fechas: date-fns
- Exportación: xlsx

El dashboard es una SPA que consume un único endpoint `/api/dashboard` con filtros de fecha, id de cuenta y zona horaria.

## 2) Estructura de archivos relevante

```
src/
  app/
    api/dashboard/route.ts     # Endpoint principal con todas las consultas
    eventos/[id]/route.ts      # Endpoint auxiliar (ver código si se usa)
    layout.tsx                 # Providers (React Query)
    page.tsx                   # UI principal del dashboard
    providers.tsx              # Configuración React Query
  components/ui/               # shadcn/ui adaptados al tema
  lib/db.ts                    # Pool de PostgreSQL (pg)
  types/xlsx-mjs.d.ts          # Declaración de tipos para xlsx si se requiere
DEPLOY.md                      # Guía de despliegue
CONTEXTO-IA.md                 # Este documento
```

## 3) Variables de entorno

Archivo de ejemplo (se sube a git): `.env.example`

```env
# Base de datos (server-side)
POSTGRES_HOST=your-db-hostname
POSTGRES_PORT=5432
POSTGRES_DATABASE=your-db-name
POSTGRES_USER=your-db-user
POSTGRES_PASSWORD=your-secure-password

# Configuración cliente (client-side)
NEXT_PUBLIC_CLIENT_ID=2
NEXT_PUBLIC_CLIENT_TIMEZONE=America/Bogota
NEXT_PUBLIC_CLIENT_NAME=Cliente Demo
```

Archivo local (no se sube): `.env.local` con los mismos nombres y valores reales.

Notas:
- Nunca commitear `.env.local`.
- Todas las comparaciones de strings en SQL se hacen con `LOWER(TRIM(COALESCE(col, '')))`. Procura que los valores de entorno que impactan filtros se mantengan consistentes.

## 4) Conexión a base de datos (`src/lib/db.ts`)

- Usa `pg.Pool` con SSL (`rejectUnauthorized: false`).
- Valida presencia de `POSTGRES_HOST`, `POSTGRES_DATABASE`, `POSTGRES_USER`, `POSTGRES_PASSWORD` al inicializar.
- El puerto se lee de `POSTGRES_PORT` (default 5432).

## 5) API de datos (`src/app/api/dashboard/route.ts`)

Endpoint GET `/api/dashboard` con parámetros:
- `fecha_inicio` (string ISO)
- `fecha_fin` (string ISO)
- `id_cuenta` (int; default 2 si no se envía)
- `tz` (zona horaria; default `America/Bogota`)

Todas las consultas aplican la zona horaria con `AT TIME ZONE $4` cuando corresponde a timestamps y convierten a `::date` para filtrar por rango.

### 5.1 kpiQuery (CTEs principales)

- `eventos_llamadas`: desde `eventos_llamadas_tiempo_real` (fuente verdad para shows/calificadas/cierres). Calcula:
  - `total_llamadas_tomadas` (conteo total de eventos)
  - `reuniones_calificadas` (categoria IN 'ofertada','cerrada')
  - `llamadas_cerradas` (categoria = 'cerrada')
  - `cash_collected_total`, `facturacion_total`
- `datos_publicidad`: desde `resumenes_diarios_ads` (suma de gasto, impresiones, promedios de CTR, VSL).
- `datos_agendas`: desde `resumenes_diarios_agendas` (fecha de agendamiento):
  - `reuniones_agendadas`, `agendas_canceladas`, `agendas_pdte`, `no_show_count`
  - `agendas_calificadas` (Ofertada/Cerrada)
  - `agendas_validas` (NOT IN 'pdte','cancelada')
  - `agendas_asistidas` (NOT IN 'pdte','cancelada','no_show')

Selección final expone, entre otros:
- `total_gasto_ads`, `impresiones`, `ctr`, `vsl_play_rate`, `vsl_engagement`
- `reuniones_agendadas`, `llamadas_canceladas`, `llamadas_pendientes`, `no_show_agendas`
- `agendas_efectivas`, `llamadas_tomadas_agendas`
- `reuniones_calificadas` (de agendas)
- `total_llamadas_tomadas`, `total_cierres`, `total_facturacion`, `cash_collected` (de eventos)
- KPIs calculados: `ticket_promedio`, `cac`, `costo_por_agenda_calificada`, `costo_por_show`, `roas`, `roas_cash_collected`, `no_show` (GREATEST(agendadas - tomadas_eventos, 0))

Importante: en tarjetas del frontend, los totales de asistidas/calificadas/cerradas se alinean con eventos (suma por closer), y el denominador del show rate usa `agendas_efectivas`.

### 5.2 seriesQuery

Serie temporal por día uniendo `resumenes_diarios_llamadas` con `resumenes_diarios_ads` (facturación, gasto, tomadas, cierres).

### 5.3 closerQuery

- `closers_eventos`: agrega por `closer` desde eventos (tomadas, cierres, facturación, cash_collected, reuniones_calificadas, shows).
- `closers_no_show`: agrega `no_show` desde agendas para incluir closers sin eventos. Se hace `FULL OUTER JOIN` para no perder ninguno.

### 5.4 eventsQuery

Une:
- `eventos_atendidos`: eventos reales (id_evento::text, fecha con TZ, link_llamada, tipo_registro='evento').
- `eventos_no_show`: provenientes de agendas (prefijo 'NS-...', resume/link NULL::text, tipo_registro='no_show').

### 5.5 pendientesQuery

Lista de `PDTE` con fechas ajustadas a TZ e incluye `fecha_de_la_reunion`.

### 5.6 adsKpisQuery / 5.7 callsKpisQuery

- `adsKpisQuery`: suma spend/impresiones/clicks; CTR% calculado; play_rate/engagement promedio; `reuniones_agendadas` vía conteo en agendas.
- `callsKpisQuery`: totales desde `resumenes_diarios_llamadas` (heredado para compatibilidad).

### 5.8 adsByOriginQuery

Base de creativos:
- `creativos_periodo`: creativos activos en el rango desde `resumenes_diarios_creativos`.
- `creativos_base`: GASTO HISTÓRICO total por creativo (sin filtro de fecha) para usar como `spend_allocated`.
- `creativos_solo_agendas`/`creativos_solo_eventos`: creativos que aparecen solo en agendas/eventos y no están en `creativos_periodo`.
- `todos_creativos`: unión de las tres fuentes anteriores.

Métricas por creativo:
- `agendas_creativo`: conteo de agendas por `origen` (mapeando NULL/'' a 'organico').
- `pendientes_creativo`: conteo de `PDTE` por `origen`.
- `resultados_creativo`: desde eventos, calcula `tomadas`, `calificadas`, `shows` (conteo total), `cierres`, `facturacion`, `cash_collected`.

Selección final expone: `agendas`, `tomadas`, `calificadas`, `shows`, `cierres`, `facturacion`, `cash_collected`, `spend_allocated`, `llamadas_pendientes` y tasas:
- `show_rate_pct = (tomadas / agendas) * 100`
- `close_rate_pct = (cierres / agendas) * 100`

Orden por defecto: `cierres DESC, facturacion DESC` (el frontend reordena para su vista).

### 5.9 Contrato de respuesta

El JSON devuelto incluye: `kpis`, `series`, `closers`, `events`, `adsKpis`, `callsKpis`, `adsByOrigin`, `hoy`, `pendientes`. Los campos numéricos se parsean a `number` en el mapeo antes de responder.

## 6) Frontend (`src/app/page.tsx`)

- Carga datos con React Query usando la key: `["dashboard", `id:${NEXT_PUBLIC_CLIENT_ID}`, `tz:${NEXT_PUBLIC_CLIENT_TIMEZONE}`, startDateISO, endDateISO]`.
- Formatea fechas de `series` a `yyyy-MM-dd` con `date-fns/format`.
- Totales globales alineados al Leaderboard:
  - `totalShowsEventos = sum(closers[].shows)`
  - `totalCalificadasEventos = sum(closers[].reuniones_calificadas)`
  - `totalCierresEventos = sum(closers[].cierres)`
  - Se usan `Number(...)` en los reduce para evitar concatenación de strings.

Tarjetas destacadas:
- Reuniones asistidas (show rate): numerador = `totalShowsEventos`; denominador = `kpis.agendas_efectivas`.
- Reuniones calificadas: `totalCalificadasEventos`.
- Llamadas cerradas (close rate): `totalCierresEventos / totalCalificadasEventos`.
- % Calificación: `totalCalificadasEventos / totalShowsEventos`.
- Llamadas pendientes (PDTE): `kpis.llamadas_pendientes`.
- Llamadas canceladas: `kpis.llamadas_canceladas`.

Resumen por Métodos de Adquisición:
- Muestra `agendas`, `tomadas`, `calificadas`, `cierres`, `facturacion`, `cash_collected`, `spend_allocated`, `llamadas_pendientes`, `show_rate_pct`, `close_rate_pct`.
- Orden en UI: (1) `cash_collected` DESC, (2) `agendas` DESC, (3) `spend_allocated` DESC, (4) `anuncio_origen` A→Z.
- Nulos o vacíos en `origen` se agrupan como `organico`.

Exportación a Excel:
- Import estático `import * as XLSX from "xlsx"`.
- Se generan hojas: KPIs, Ads_KPIs, Calls_KPIs, Hoy, Series, Closers, Eventos, Ads_por_Origen, Pendientes_PDTE.
- `resumen_ia` se trunca a ~32,000 caracteres para evitar el límite de celdas en Excel (~32,767).

## 7) Reglas de fechas y normalización de strings

- TZ: el backend recibe `tz` y aplica `AT TIME ZONE $4` en timestamps. Los filtros por día usan `::date` ya ajustado a la TZ del cliente.
- Comparaciones de strings: siempre `LOWER(TRIM(COALESCE(col, '')))`. Esto evita problemas de mayúsculas, espacios y nulos.

## 8) Despliegue en Vercel

Ver `DEPLOY.md`. Puntos clave:
- Node 20.x (por `engines`), Next 15.5.x.
- Configurar TODAS las variables del `.env.local` en Project Settings → Environment Variables (Production/Preview/Development).
- Nunca exponer secretos en el repo.

## 9) Pruebas manuales y verificación

Checklist rápido tras cambios:
- Filtrado por fechas respeta la zona horaria del cliente.
- Show rate ≤ 100% cuando numerador/denominador están en la misma dimensión temporal.
- Leaderboard y tarjetas usan las mismas fuentes (eventos) para asistidas/calificadas/cerradas.
- En Ads por Origen, creativos sin matching en creativos_base siguen apareciendo y `spend_allocated` viene del histórico.
- Exportación Excel funciona y no supera límites de texto.

---

Última revisión: generar este archivo automáticamente al cambiar contratos del endpoint o los KPIs.

## 10) Cambios recientes

Fecha: 2025-11-24

- Resumen por Métodos de Adquisición (UI):
  - Se agregó un buscador de creativos en el encabezado de la sección.
  - Filtra exclusivamente por `anuncio_origen` (case-insensitive) y aplica el filtro antes del ordenamiento.
  - Implementación: estado `creativoFilter` y `<Input>` en `src/app/page.tsx`.
- Branding del cliente:
  - Se usa `NEXT_PUBLIC_CLIENT_NAME` para:
    - Barra superior (layout global) y `metadata.title` (`src/app/layout.tsx`).
    - Encabezado principal de la página: `<h1>{clientName} - Traking Automático</h1>` (`src/app/page.tsx`).
- Llamadas pendientes:
  - La sección se ubica al final del dashboard con un diseño mejorado (tabla con: fecha de agendamiento, lead, fecha de la reunión, email, closer, estado).
  - Origen de datos: `pendientesQuery` en backend; se muestra el total en el encabezado de la card.
  - Cambio reciente: se removieron las columnas “Fecha de agendamiento” y “Fecha de la reunión” en la tabla, manteniendo: Lead, Email, Closer, Estado.

