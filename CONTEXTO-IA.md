# AutoKpi - Tracking Automático - Contexto Completo para IA

## 📋 Descripción General del Proyecto

**AutoKpi** es un dashboard de análisis de ventas y marketing de alto rendimiento construido con Next.js 14+. Es una aplicación web de una sola página (SPA) que se conecta a una base de datos PostgreSQL para mostrar métricas clave de negocio en tiempo real.

### 🎯 Objetivo Principal
Crear una interfaz futurista, limpia, extremadamente rápida y funcional que permita visualizar:
- KPIs de ventas y marketing
- Rendimiento de vendedores individuales ("closers")
- Análisis de anuncios por origen
- Series de tiempo para tendencias
- Detalles granulares de llamadas y eventos

## 🏗️ Arquitectura Técnica

### Stack Tecnológico Principal
- **Frontend**: Next.js 14+ con App Router
- **Lenguaje**: TypeScript (strict mode)
- **Estilos**: Tailwind CSS con tema oscuro futurista
- **Base de Datos**: PostgreSQL con SSL
- **Cliente DB**: `pg` (node-postgres)
- **Visualización**: Recharts (AreaChart, BarChart)
- **Estado**: @tanstack/react-query para server state
- **UI Components**: shadcn/ui
- **Fechas**: date-fns
- **Despliegue**: Vercel

### Componentes shadcn/ui Utilizados
- `Card` - Para contenedores de KPIs y secciones
- `Table` - Para leaderboards y datos tabulares
- `Accordion` - Para detalles expandibles de closers
- `Select` - Para filtros y opciones
- `Calendar` - Para selector de fechas (con fix de hidratación)
- `Popover` - Para dropdowns del calendario (y UI secundaria)
- `Dialog` - Para modales a pantalla completa (notas de closers)
- `Button` - Para acciones interactivas
- `Input` - Para búsqueda de leads

## 📁 Estructura de Archivos

```
aura-tracker/
├── src/
│   ├── app/
│   │   ├── api/dashboard/route.ts    # Endpoint único de datos
│   │   ├── layout.tsx                # Layout raíz con Providers
│   │   ├── page.tsx                  # Dashboard principal
│   │   ├── providers.tsx             # React Query Provider
│   │   └── globals.css               # Estilos globales
│   ├── components/ui/                # Componentes shadcn/ui
│   │   ├── accordion.tsx             # (con fix text-white)
│   │   ├── button.tsx
│   │   ├── calendar.tsx              # (con fix hidratación)
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── popover.tsx
│   │   ├── select.tsx
│   │   └── table.tsx                 # (con fix text-white)
│   └── lib/
│       └── db.ts                     # Conexión PostgreSQL
├── .env.local                        # Variables de entorno (NO subir)
├── package.json                      # Dependencias y scripts
└── CONTEXTO-IA.md                   # Este archivo
```

## 🗄️ Estructura de Base de Datos

### Tablas Principales

#### `resumenes_diarios_llamadas`
```sql
- id_cuenta (int) - ID de la cuenta (por defecto 2)
- fecha (date) - Fecha del resumen
- facturacion_total (decimal) - Facturación total del día
- llamadas_tomadas (int) - Número de llamadas atendidas
- llamadas_ofertadas (int) - Llamadas donde se hizo oferta
- cierres (int) - Llamadas que resultaron en venta
- fees (decimal) - Comisiones/fees cobrados
```

#### `resumenes_diarios_ads`
```sql
- id_cuenta (int) - ID de la cuenta
- fecha (date) - Fecha del resumen
- gasto_total_ad (decimal) - Gasto en publicidad
- impresiones_totales (bigint) - Total de impresiones
- clicks_unicos (int) - Clicks únicos
- play_rate (decimal) - Tasa de reproducción VSL
- engagement (decimal) - Engagement VSL
- agendamientos (int) - Reuniones agendadas
```

#### `eventos_llamadas_tiempo_real`
```sql
- id_evento (uuid) - ID único del evento
- id_cuenta (int) - ID de la cuenta
- fecha_hora_evento (timestamp) - Timestamp del evento
- closer (varchar) - Nombre del vendedor
- cliente (varchar) - Nombre del cliente/lead
- categoria (varchar) - Tipo de evento (show, oferta, etc.)
- cash_collected (decimal) - Dinero cobrado
- facturacion (decimal) - Facturación generada
- anuncio_origen (varchar) - Origen del anuncio
- resumen_ia (text) - Resumen generado por IA
```

## 🔌 API Endpoint

### `/api/dashboard` (GET)

**Parámetros requeridos:**
- `fecha_inicio` (string, formato ISO)
- `fecha_fin` (string, formato ISO)
- `id_cuenta` (por defecto 2 si no se envía)
- `tz` (zona horaria; por defecto `America/Bogota`)

**Respuesta JSON:**
```typescript
{
  kpis: {
    total_facturacion: number,
    total_gasto_ads: number,
    total_llamadas_tomadas: number,
    total_cierres: number
  },
  adsKpis: {
    spend: number,
    impresiones: number,
    ctr_pct: number,
    vsl_play_rate: number,
    vsl_engagement: number,
    reuniones_agendadas: number
  },
  callsKpis: {
    reuniones_asistidas: number,
    reuniones_calificadas: number,
    llamadas_cerradas: number,
    facturacion: number,
    fees: number
  },
  series: Array<{
    fecha: string,
    facturacion: number,
    gasto_ads: number,
    llamadas_tomadas: number,
    cierres: number
  }>,
  closers: Array<{
    closer: string,
    llamadas_tomadas: number,
    cierres: number,
    facturacion_generada: number
  }>,
  events: Array<{
    id_evento: string,
    fecha_hora_evento: string,
    closer: string,
    cliente: string,
    categoria: string,
    cash_collected: number,
    facturacion: number,
    anuncio_origen: string,
    resumen_ia: string
  }>,
  adsByOrigin: Array<{
    anuncio_origen: string,
    agendas: number,
    shows?: number,
    cierres: number,
    facturacion: number,
    cash_collected?: number,
    spend_allocated: number
  }>
}
```

## 🎨 Diseño y UI

### Tema Visual
- **Fondo**: Gris muy oscuro (#0a0a0a, #0b0b0b)
- **Texto principal**: Blanco (#ffffff)
- **Texto secundario**: Gris claro (#d1d5db, #9ca3af)
- **Colores de acento**:
  - Cian: #22d3ee (para facturación)
  - Azul eléctrico: #3b82f6 (para llamadas)
  - Verde neón: #10b981 (para cierres)
  - Púrpura: #a78bfa (para gastos)
  - Fucsia: #f472b6 (para costos)

### Efectos Visuales
- Gradientes sutiles en las cards
- Sombras con glow de colores
- Bordes con opacidad
- Backdrop blur effects
- Micro-animaciones en hover

### Layout Responsivo
- Grid adaptativo: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5`
- Breakpoints Tailwind estándar
- Tablas con scroll horizontal en móviles

## 📊 Fórmulas y Cálculos de KPIs

### KPIs Calculados en Frontend
```typescript
// Tasa de Cierre General
tasa_cierre = (total_cierres / total_llamadas_tomadas) * 100

// CTR (calculado en backend)
ctr = (clicks_unicos / impresiones_totales) * 100

// Ticket Promedio
ticket_promedio = facturacion_total / llamadas_cerradas

// ROAS (Return on Ad Spend)
roas = facturacion_total / gasto_publicidad

// Costo por Agenda Calificada
costo_por_agenda = gasto_publicidad / reuniones_calificadas

// Costo por Show
costo_por_show = gasto_publicidad / reuniones_asistidas

// CAC (Customer Acquisition Cost)
cac = gasto_publicidad / llamadas_cerradas

// Show Rate (por anuncio)
show_rate = (shows / agendas) * 100
```

### Mapeo de Datos Importante
- `reuniones_asistidas` = `llamadas_tomadas` (de resumenes_diarios_llamadas)
- `reuniones_calificadas` = `llamadas_ofertadas`
- `llamadas_cerradas` = `cierres`
- `cash_collected` = `fees` (de resumenes_diarios_llamadas)

## 🔄 Gestión de Estado

### React Query
- **Query Key**: `[
  "dashboard",
  "id:2",
  "tz:America/Bogota",
  startDate.toISOString(),
  endDate.toISOString()
]`
- **Cache time**: Defecto de React Query
- **Refetch**: Automático al cambiar fechas
- **Error handling**: Muestra mensaje de error en UI
- **Loading**: Skeleton placeholder mientras carga

### Estado Local
```typescript
const [startDate, setStartDate] = useState<Date>() // Fecha inicio
const [endDate, setEndDate] = useState<Date>()     // Fecha fin
const [closerFilter, setCloserFilter] = useState<Record<string, string>>({}) // Filtro por lead por closer
```

## 🐛 Problemas Conocidos y Soluciones

### 1. Error de Hidratación (Calendar)
**Problema**: Diferencias en formato de fecha entre servidor y cliente
**Solución**: 
- Usar `day.date.toISOString().split('T')[0]` para `data-day`
- Fijar locale en `formatMonthDropdown` a "en-US"

### 2. TypeError con .toFixed()
**Problema**: Valores null/undefined de la DB
**Solución**: 
- Coerción explícita con `Number()` en API
- Valores por defecto con `?? 0`
- Guards en frontend: `Number(value || 0).toFixed(2)`

### 3. Variables de Entorno en Vercel
**Problema**: ECONNREFUSED cuando env vars no están configuradas
**Solución**: Valores por defecto en `lib/db.ts`

### 4. ESLint Errors
**Problema**: `@typescript-eslint/no-explicit-any`
**Solución**: Tipado explícito para todas las queries y responses

## 🚀 Despliegue

### Configuración Vercel
- **Framework**: Next.js (auto-detectado)
- **Node Version**: 20.x (por engines en package.json)
- **Build Command**: `npm run build`
- **Install Command**: `npm install`

### Variables de Entorno Requeridas
```env
POSTGRES_HOST=mainbd.automatizacionesia.com
POSTGRES_PORT=5432
POSTGRES_DATABASE=postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=R81N0ds7Cr8b
```

### Comandos de Desarrollo
```bash
npm run dev          # Desarrollo local
npm run build        # Build de producción
npm run start        # Servidor de producción
npm run lint         # ESLint
```

## 📝 Convenciones de Código

### Naming
- Componentes: PascalCase
- Variables: camelCase
- Archivos: kebab-case para páginas, PascalCase para componentes
- CSS Classes: Tailwind utilities

### TypeScript
- Strict mode habilitado
- Interfaces para todos los tipos de datos
- No usar `any` (usar `unknown` si es necesario)
- Props tipadas para todos los componentes

### Git
- Commits descriptivos con prefijos: `feat:`, `fix:`, `refactor:`, `chore:`
- Branch principal: `main`
- Deploy automático desde `main` a Vercel

## 🔧 Extensibilidad

### Agregar Nuevos KPIs
1. Modificar query en `/api/dashboard/route.ts`
2. Actualizar tipos TypeScript en `page.tsx`
3. Agregar Card con fórmula correspondiente
4. Usar colores y estilos consistentes

### Nuevas Visualizaciones
1. Instalar dependencias si es necesario
2. Importar componentes de Recharts
3. Mantener tema oscuro y colores de acento
4. Responsive design obligatorio

### Filtros Adicionales
1. Agregar estado local para el filtro
2. Modificar query key de React Query
3. Actualizar API endpoint si es necesario
4. UI consistente con selector de fechas existente

## ⚠️ Reglas Críticas para IA

1. **NUNCA modificar la estructura de la base de datos** sin consultar
2. **SIEMPRE usar TypeScript estricto** - no usar `any`
3. **MANTENER el tema oscuro futurista** - no cambiar colores principales
4. **VALIDAR todas las fórmulas matemáticas** antes de implementar
5. **TESTEAR hidratación** después de modificar componentes de fecha
6. **USAR valores por defecto** para evitar crashes con datos null/undefined
7. **MANTENER responsive design** en todos los cambios
8. **SEGUIR convenciones de naming** establecidas
9. **NO eliminar configuraciones de SSL** de la base de datos
10. **VERIFICAR ESLint** antes de hacer push

## 📞 Datos de Conexión

### Base de Datos PostgreSQL
- **Host**: mainbd.automatizacionesia.com
- **Puerto**: 5432
- **Base**: postgres
- **Usuario**: postgres
- **SSL**: Requerido (rejectUnauthorized: false)

### Repositorio
- **GitHub**: https://github.com/lcqv/trackertest.git
- **Branch**: main
- **Vercel**: Auto-deploy habilitado

---

*Última actualización: $(date)*
*Versión del proyecto: 1.0.0*
*Stack: Next.js 15.5.3 + TypeScript + PostgreSQL*
