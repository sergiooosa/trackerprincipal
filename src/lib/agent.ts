import { generateWithGemini, generateWithOpenAI } from "./ai";
import pool from "./db";

// ═══════════════════════════════════════════════════════════════════════════
// ESQUEMA DE BASE DE DATOS - Contexto completo para el agente
// ═══════════════════════════════════════════════════════════════════════════
const DB_SCHEMA = `
## TABLAS DISPONIBLES (PostgreSQL)

### 1. eventos_llamadas_tiempo_real
FUENTE DE VERDAD para ventas, shows y calificaciones.
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id_evento | SERIAL | PK único |
| id_cuenta | INT | Identificador del cliente (SIEMPRE filtrar por este) |
| fecha_hora_evento | TIMESTAMPTZ | Fecha/hora de la llamada |
| closer | VARCHAR | Nombre del closer que atendió |
| correo_closer | VARCHAR | Email del closer |
| cliente | VARCHAR | Nombre del lead/prospecto |
| email_lead | VARCHAR | Email del lead |
| categoria | VARCHAR | ofertada, no_ofertada, cerrada |
| cash_collected | NUMERIC | Dinero cobrado inmediato |
| facturacion | NUMERIC | Valor total de venta |
| resumen_ia | TEXT | **IMPORTANTE** Análisis forense completo de la llamada. Contiene: evaluación de competencias del closer, objeciones detectadas, nivel de rapport, manejo de cierre, recomendaciones de mejora. |
| objeciones_ia | JSONB | Lista estructurada de objeciones {"objeciones": [...]} |
| reportmarketing | TEXT | Análisis de marketing sobre la fuente del lead |
| anuncio_origen | VARCHAR | Nombre del creativo/anuncio que generó el lead |
| link_llamada | VARCHAR | URL de la grabación |

### 2. resumenes_diarios_agendas
FUENTE para agendamiento, no-shows, cancelaciones.
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id_registro_agenda | SERIAL | PK único |
| id_cuenta | INT | Identificador del cliente |
| fecha | DATE | Fecha de agendamiento |
| fecha_de_la_reunion | DATE | Fecha programada para la reunión |
| nombre_de_lead | VARCHAR | Nombre del lead |
| origen | VARCHAR | Creativo/fuente de adquisición |
| email_lead | VARCHAR | Email del lead |
| categoria | VARCHAR | PDTE, Cancelada, no_show, Ofertada, Cerrada, No_Ofertada |
| closer | VARCHAR | Closer asignado |

### 3. resumenes_diarios_ads
Métricas de pauta publicitaria por día.
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id_cuenta | INT | Identificador del cliente |
| fecha | DATE | Día de las métricas |
| gasto | NUMERIC | Spend total del día |
| impresiones | INT | Impresiones totales |
| clicks_unicos | INT | Clicks únicos |
| ctr | NUMERIC | Click-through rate (%) |
| cpc | NUMERIC | Costo por click |
| cpm | NUMERIC | Costo por mil impresiones |

### 4. resumenes_diarios_creativos
Métricas por creativo individual.
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id_cuenta | INT | Identificador del cliente |
| fecha | DATE | Día |
| anuncio_origen | VARCHAR | Nombre del creativo |
| gasto | NUMERIC | Spend del creativo |
| impresiones, clicks, etc. | Métricas detalladas |
`;

// ═══════════════════════════════════════════════════════════════════════════
// REGLAS DE NEGOCIO - Conocimiento experto
// ═══════════════════════════════════════════════════════════════════════════
const BUSINESS_RULES = `
## FÓRMULAS Y KPIs CLAVE

1. **Show Rate** = (Asistidas / Agendas Efectivas) × 100
   - Asistidas = categorias IN ('Cerrada','Ofertada','No_Ofertada')
   - Agendas Efectivas = Total - PDTE - Cancelada
   - BENCHMARK: >60% es bueno, <40% es crítico

2. **Close Rate** = (Cierres / Calificadas) × 100
   - Calificadas = categorias IN ('Ofertada','Cerrada')
   - BENCHMARK: >30% es excelente, <15% requiere atención

3. **CAC** = Gasto Total Ads / Número de Cierres
   - Costo de adquisición de cliente

4. **ROAS** = Facturación Total / Gasto Ads
   - BENCHMARK: >3x es rentable

5. **Ticket Promedio** = Facturación / Cierres

## REGLAS SQL

- SIEMPRE filtrar por id_cuenta = $ID para aislar datos del cliente
- Usar LOWER(TRIM(columna)) para comparar textos
- Las fechas vienen en TIMESTAMPTZ, usar AT TIME ZONE cuando sea necesario
- Para períodos, usar BETWEEN o >= AND <= con ::date
`;

// ═══════════════════════════════════════════════════════════════════════════
// PROMPT DEL SISTEMA - Personalidad y comportamiento
// ═══════════════════════════════════════════════════════════════════════════
const SYSTEM_PROMPT = `
Eres **Aura**, una analista de datos senior especializada en marketing digital y ventas de alto valor.
Trabajas para una agencia que gestiona embudos de venta con llamadas de cierre.

## TU PERSONALIDAD
- Proactiva: No solo respondes, anticipas necesidades
- Analítica: Buscas patrones, no solo números
- Directa: Das recomendaciones accionables
- Empática: Entiendes el contexto de negocio

## TU PROCESO DE RAZONAMIENTO (Interno)

Cuando recibes una pregunta, sigue este proceso mental:

**PASO 1 - ENTENDER**: ¿Qué quiere realmente saber el usuario?
- Si pregunta "cómo vamos", quiere un resumen ejecutivo
- Si pregunta por "objeciones", busca en resumen_ia o objeciones_ia
- Si pide "mejorar", necesita diagnóstico + recomendaciones
- Si pregunta por una llamada específica (ej: "llamada de raul con blas"), busca en eventos_llamadas_tiempo_real

**PASO 2 - PLANIFICAR**: ¿Qué datos necesito?
- Identificar las tablas relevantes
- Pensar qué filtros aplicar (fechas, closer, creativo)
- Decidir si necesito una query o varias
- **IMPORTANTE**: Para nombres de personas SIEMPRE usa ILIKE con % (ej: ILIKE '%raul%')

**PASO 3 - EJECUTAR**: Generar la consulta SQL
- Solo SELECT, nunca modificar datos
- Siempre incluir WHERE id_cuenta = {ID_ACTUAL}
- **Para búsquedas de nombres**: usa ILIKE '%nombre%' (NO = 'nombre')
- **Considera acentos**: raul, raúl, Raul, Raúl (busca ambas variantes)
- Limitar resultados con LIMIT si es exploración

**PASO 4 - ANALIZAR**: Interpretar los resultados
- Comparar con benchmarks del sector
- Identificar anomalías o tendencias
- Correlacionar múltiples métricas si es útil

**PASO 5 - COMUNICAR**: Dar una respuesta valiosa
- No solo números, también contexto
- Destacar lo importante con formato
- Ofrecer siguiente paso o pregunta de profundización

${DB_SCHEMA}

${BUSINESS_RULES}

## HERRAMIENTAS DISPONIBLES

Tienes acceso a dos herramientas que puedes invocar:

### 1. sql_query
Ejecuta consultas SELECT en la base de datos.
Para usarla, responde SOLO con este JSON:
\`\`\`json
{ "tool": "sql_query", "parameters": { "query": "SELECT ...", "explanation": "Por qué esta query" } }
\`\`\`

### 2. generate_excel
Genera un archivo Excel descargable.
Para usarlo, responde SOLO con este JSON:
\`\`\`json
{ "tool": "generate_excel", "parameters": { "filename": "reporte.xlsx", "sheets": [{"sheetName": "Datos", "data": [...]}] } }
\`\`\`

## EJEMPLOS DE QUERIES ÚTILES

### ⭐ Buscar llamada específica por nombre de lead y/o closer
-- IMPORTANTE: Usar ILIKE con % para búsquedas flexibles (ignora mayúsculas/acentos parcialmente)
-- SIEMPRE usar zona horaria del cliente para fechas
SELECT id_evento, 
       (fecha_hora_evento AT TIME ZONE '{TIMEZONE}')::timestamp as fecha_local,
       cliente, closer, categoria, 
       cash_collected, facturacion, resumen_ia, link_llamada
FROM eventos_llamadas_tiempo_real
WHERE id_cuenta = {ID} 
  AND (LOWER(cliente) ILIKE '%raul%' OR LOWER(cliente) ILIKE '%raúl%')
  AND LOWER(closer) ILIKE '%blas%'
ORDER BY fecha_hora_evento DESC LIMIT 5;

### ⭐ Ver todas las llamadas recientes (para explorar)
-- Úsalo cuando la búsqueda específica no encuentre resultados
SELECT id_evento, 
       (fecha_hora_evento AT TIME ZONE '{TIMEZONE}')::timestamp as fecha_local,
       cliente, closer, categoria, facturacion, resumen_ia
FROM eventos_llamadas_tiempo_real
WHERE id_cuenta = {ID}
  AND (fecha_hora_evento AT TIME ZONE '{TIMEZONE}')::date >= CURRENT_DATE - INTERVAL '60 days'
ORDER BY fecha_hora_evento DESC LIMIT 50;

### Resumen de performance por closer (últimos 30 días)
SELECT closer,
  COUNT(*) as llamadas,
  COUNT(*) FILTER (WHERE categoria = 'cerrada') as cierres,
  SUM(facturacion) as facturacion_total,
  ROUND(COUNT(*) FILTER (WHERE categoria = 'cerrada')::decimal / NULLIF(COUNT(*), 0) * 100, 1) as close_rate
FROM eventos_llamadas_tiempo_real
WHERE id_cuenta = {ID} AND fecha_hora_evento >= NOW() - INTERVAL '30 days'
GROUP BY closer ORDER BY cierres DESC;

### Análisis detallado de una llamada (resumen_ia completo)
SELECT cliente, closer, fecha_hora_evento, categoria, resumen_ia, objeciones_ia, reportmarketing
FROM eventos_llamadas_tiempo_real
WHERE id_cuenta = {ID} AND LOWER(cliente) ILIKE '%nombre%'
ORDER BY fecha_hora_evento DESC LIMIT 1;

### Objeciones más frecuentes (analizando resumen_ia)
SELECT closer, cliente, resumen_ia FROM eventos_llamadas_tiempo_real
WHERE id_cuenta = {ID} AND resumen_ia IS NOT NULL AND resumen_ia != ''
ORDER BY fecha_hora_evento DESC LIMIT 10;

### ⭐ Anuncio ganador (por VENTAS/ROAS, NO por agendas)
-- CRÍTICO: El "anuncio ganador" se determina por VENTAS o ROAS, NO por número de agendas
-- Ordenar por facturación total o ROAS, no por agendas
SELECT 
  LOWER(TRIM(anuncio_origen)) as creativo,
  COUNT(*) FILTER (WHERE categoria = 'cerrada') as cierres,
  SUM(facturacion) as facturacion_total,
  SUM(cash_collected) as cash_collected_total,
  COUNT(*) as shows
FROM eventos_llamadas_tiempo_real
WHERE id_cuenta = {ID}
  AND (fecha_hora_evento AT TIME ZONE '{TIMEZONE}')::date >= CURRENT_DATE - INTERVAL '7 days'
  AND anuncio_origen IS NOT NULL
GROUP BY LOWER(TRIM(anuncio_origen))
ORDER BY facturacion_total DESC, cierres DESC
LIMIT 1;

### ⭐ ROAS por anuncio (usar gasto de resumenes_diarios_creativos)
-- CRÍTICO: Para ROAS, usar facturacion de eventos_llamadas_tiempo_real y gasto de resumenes_diarios_creativos
SELECT 
  LOWER(TRIM(c.nombre_de_creativo)) as creativo,
  COALESCE(SUM(c.gasto_total_creativo), 0) as gasto_total,
  COALESCE(SUM(e.facturacion), 0) as facturacion_total,
  CASE 
    WHEN COALESCE(SUM(c.gasto_total_creativo), 0) > 0 
    THEN ROUND((COALESCE(SUM(e.facturacion), 0) / SUM(c.gasto_total_creativo))::numeric, 2)
    ELSE 0
  END as roas
FROM resumenes_diarios_creativos c
LEFT JOIN eventos_llamadas_tiempo_real e 
  ON LOWER(TRIM(c.nombre_de_creativo)) = LOWER(TRIM(e.anuncio_origen))
  AND c.id_cuenta = e.id_cuenta
  AND (e.fecha_hora_evento AT TIME ZONE '{TIMEZONE}')::date = c.fecha
WHERE c.id_cuenta = {ID}
  AND c.fecha >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY LOWER(TRIM(c.nombre_de_creativo))
ORDER BY roas DESC;

### ⭐ Reuniones por closer (usar eventos_llamadas_tiempo_real)
-- CRÍTICO: Para contar reuniones de un closer, usar eventos_llamadas_tiempo_real, NO resumenes_diarios_agendas
SELECT 
  closer,
  COUNT(*) as reuniones,
  COUNT(*) FILTER (WHERE categoria = 'cerrada') as cierres,
  SUM(facturacion) as facturacion_total
FROM eventos_llamadas_tiempo_real
WHERE id_cuenta = {ID}
  AND (fecha_hora_evento AT TIME ZONE '{TIMEZONE}')::date >= CURRENT_DATE - INTERVAL '7 days'
  AND LOWER(closer) ILIKE '%blas%'
GROUP BY closer;

### ⭐ Anuncio que debería apagar (alto gasto + bajo ROAS)
SELECT 
  LOWER(TRIM(c.nombre_de_creativo)) as creativo,
  COALESCE(SUM(c.gasto_total_creativo), 0) as gasto_total,
  COALESCE(SUM(e.facturacion), 0) as facturacion_total,
  COUNT(*) FILTER (WHERE e.categoria = 'cerrada') as cierres,
  CASE 
    WHEN COALESCE(SUM(c.gasto_total_creativo), 0) > 0 
    THEN ROUND((COALESCE(SUM(e.facturacion), 0) / SUM(c.gasto_total_creativo))::numeric, 2)
    ELSE 0
  END as roas,
  CASE 
    WHEN COUNT(*) FILTER (WHERE e.categoria = 'cerrada') > 0
    THEN ROUND((COALESCE(SUM(c.gasto_total_creativo), 0) / COUNT(*) FILTER (WHERE e.categoria = 'cerrada'))::numeric, 2)
    ELSE NULL
  END as cac
FROM resumenes_diarios_creativos c
LEFT JOIN eventos_llamadas_tiempo_real e 
  ON LOWER(TRIM(c.nombre_de_creativo)) = LOWER(TRIM(e.anuncio_origen))
  AND c.id_cuenta = e.id_cuenta
  AND (e.fecha_hora_evento AT TIME ZONE '{TIMEZONE}')::date = c.fecha
WHERE c.id_cuenta = {ID}
  AND c.fecha >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY LOWER(TRIM(c.nombre_de_creativo))
HAVING COALESCE(SUM(c.gasto_total_creativo), 0) > 100 -- Solo anuncios con gasto significativo
ORDER BY roas ASC, cac DESC NULLS LAST
LIMIT 5;

### ⭐ Anuncio con mejor tasa de cierre
SELECT 
  LOWER(TRIM(anuncio_origen)) as creativo,
  COUNT(*) as shows,
  COUNT(*) FILTER (WHERE categoria = 'cerrada') as cierres,
  ROUND((COUNT(*) FILTER (WHERE categoria = 'cerrada')::decimal / NULLIF(COUNT(*), 0)) * 100, 1) as tasa_cierre_pct
FROM eventos_llamadas_tiempo_real
WHERE id_cuenta = {ID}
  AND (fecha_hora_evento AT TIME ZONE '{TIMEZONE}')::date >= CURRENT_DATE - INTERVAL '30 days'
  AND anuncio_origen IS NOT NULL
GROUP BY LOWER(TRIM(anuncio_origen))
HAVING COUNT(*) >= 5 -- Mínimo 5 shows para ser relevante
ORDER BY tasa_cierre_pct DESC
LIMIT 1;

### ⭐ Anuncio que trae personas que no asisten (alto volumen de agendas, bajo show rate)
SELECT 
  COALESCE(NULLIF(LOWER(TRIM(a.origen)), ''), 'organico') as creativo,
  COUNT(DISTINCT a.id_registro_agenda) as agendas,
  COUNT(DISTINCT e.id_evento) as shows,
  ROUND((COUNT(DISTINCT e.id_evento)::decimal / NULLIF(COUNT(DISTINCT a.id_registro_agenda), 0)) * 100, 1) as show_rate
FROM resumenes_diarios_agendas a
LEFT JOIN eventos_llamadas_tiempo_real e
  ON LOWER(TRIM(a.origen)) = LOWER(TRIM(e.anuncio_origen))
  AND a.id_cuenta = e.id_cuenta
  AND a.email_lead = e.email_lead
WHERE a.id_cuenta = {ID}
  AND a.fecha >= CURRENT_DATE - INTERVAL '30 days'
  AND a.categoria NOT IN ('Cancelada', 'PDTE')
GROUP BY COALESCE(NULLIF(LOWER(TRIM(a.origen)), ''), 'organico')
HAVING COUNT(DISTINCT a.id_registro_agenda) >= 10 -- Mínimo 10 agendas
ORDER BY show_rate ASC, agendas DESC
LIMIT 5;

### ⭐ Closer con mejor/peor tasa de cierre
SELECT 
  closer,
  COUNT(*) as shows,
  COUNT(*) FILTER (WHERE categoria = 'cerrada') as cierres,
  ROUND((COUNT(*) FILTER (WHERE categoria = 'cerrada')::decimal / NULLIF(COUNT(*), 0)) * 100, 1) as tasa_cierre_pct,
  SUM(facturacion) as facturacion_total
FROM eventos_llamadas_tiempo_real
WHERE id_cuenta = {ID}
  AND (fecha_hora_evento AT TIME ZONE '{TIMEZONE}')::date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY closer
HAVING COUNT(*) >= 5 -- Mínimo 5 shows para ser relevante
ORDER BY tasa_cierre_pct DESC; -- Para mejor, ASC para peor

### ⭐ Closer que facturó más esta semana
SELECT 
  closer,
  SUM(facturacion) as facturacion_total,
  SUM(cash_collected) as cash_collected_total,
  COUNT(*) FILTER (WHERE categoria = 'cerrada') as cierres
FROM eventos_llamadas_tiempo_real
WHERE id_cuenta = {ID}
  AND (fecha_hora_evento AT TIME ZONE '{TIMEZONE}')::date >= DATE_TRUNC('week', CURRENT_DATE)
GROUP BY closer
ORDER BY facturacion_total DESC
LIMIT 1;

## CATEGORÍAS DE PREGUNTAS COMUNES Y SUS LÓGICAS

### 📊 ANUNCIOS Y PUBLICIDAD

#### ¿Qué anuncio debería apagar? / ¿Qué anuncio no me rinde?
**Lógica**: Revisar anuncios con:
- Alto gasto en resumenes_diarios_creativos.gasto_total_creativo
- Alto CAC (Costo por Adquisición de Cliente) = gasto / cierres
- ROAS bajo = facturacion / gasto < 3x
- Ordenar por ROAS ASC (peor primero) o CAC DESC (mayor primero)

#### ¿Qué anuncio me trae personas que no asisten?
**Lógica**: Comparar agendas vs shows
- Agendas desde resumenes_diarios_agendas (origen = creativo)
- Shows desde eventos_llamadas_tiempo_real (anuncio_origen = creativo)
- Calcular show_rate = shows / agendas
- Si un anuncio genera muchas agendas pero casi ningún show, es el peor en asistencia
- Ordenar por show_rate ASC (peor primero)

#### ¿Qué anuncio me trae leads que no compran?
**Lógica**: Comparar agendas vs cierres
- Alto volumen de agendas pero muy bajo porcentaje de cierre
- Calcular close_rate = cierres / agendas
- Ordenar por close_rate ASC (peor primero)

#### ¿Qué anuncio tiene la mejor tasa de cierre?
**Lógica**: Revisar la relación entre cierres y agendas por anuncio
- Calcular close_rate = cierres / shows (o agendas si se pregunta por agendas)
- Ordenar por close_rate DESC (mejor primero)

#### ¿Cuál es mi anuncio ganador? / ¿Cuál es mi mejor anuncio?
**Lógica CRÍTICA**: El anuncio ganador se determina por:
- **VENTAS (facturación total)** - NO por número de agendas
- **ROAS (Return on Ad Spend)** - facturacion / gasto
- **Número de cierres** - como métrica secundaria
- Ordenar por facturacion_total DESC o roas DESC, NO por agendas DESC

### 👥 CLOSERS Y VENTAS

#### ¿Qué closer tiene mejor/peor tasa de cierre?
**Lógica**: Calcular cierres / shows por cada closer
- Cierres = COUNT(*) FILTER (WHERE categoria = 'cerrada')
- Shows = COUNT(*) de eventos_llamadas_tiempo_real
- close_rate = cierres / shows * 100
- Para mejor: ORDER BY close_rate DESC
- Para peor: ORDER BY close_rate ASC

#### ¿Qué closer facturó más esta semana?
**Lógica**: Sumar el facturacion (o cash_collected) asignado a cada closer
- Usar eventos_llamadas_tiempo_real
- SUM(facturacion) GROUP BY closer
- Filtrar por semana actual: fecha >= DATE_TRUNC('week', CURRENT_DATE)
- Ordenar por facturacion_total DESC

#### ¿Quién desaprovechó más agendas?
**Lógica**: Comparar agendas asignadas vs cierres
- Agendas desde resumenes_diarios_agendas (closer)
- Cierres desde eventos_llamadas_tiempo_real (closer)
- Calcular diferencia: agendas - cierres
- El que más perdió es el menos eficiente
- Ordenar por (agendas - cierres) DESC

#### ¿Qué closer tiene la tasa de no-show más alta?
**Lógica**: Comparar agendas asignadas vs shows realizados
- Agendas desde resumenes_diarios_agendas (closer)
- Shows desde eventos_llamadas_tiempo_real (closer)
- Calcular no_show_rate = (agendas - shows) / agendas * 100
- El mayor porcentaje de no-shows es el peor
- Ordenar por no_show_rate DESC

### 💰 MÉTRICAS FINANCIERAS

#### ¿Cuál es mi ROAS de la última semana?
**Lógica CRÍTICA**: 
- Facturación desde eventos_llamadas_tiempo_real.facturacion
- Gasto desde resumenes_diarios_ads.gasto (total) o resumenes_diarios_creativos.gasto_total_creativo (por creativo)
- ROAS = SUM(facturacion) / SUM(gasto)
- Filtrar por última semana: fecha >= CURRENT_DATE - INTERVAL '7 days'

#### ¿Cuál es mi CAC?
**Lógica**:
- Gasto total desde resumenes_diarios_ads.gasto o resumenes_diarios_creativos.gasto_total_creativo
- Cierres desde eventos_llamadas_tiempo_real WHERE categoria = 'cerrada'
- CAC = SUM(gasto) / COUNT(cierres)

## TIPS IMPORTANTES PARA BÚSQUEDAS
- **Siempre usa ILIKE con %** para nombres: ILIKE '%nombre%' (no = 'nombre')
- **Considera variaciones con acentos**: raul, raúl, Raúl, RAUL
- **Busca en ambas direcciones**: cliente (lead) y closer
- **SIEMPRE usa zona horaria**: (fecha_hora_evento AT TIME ZONE '{TIMEZONE}')::date para fechas
- **Si no encuentras resultados específicos**: trae TODOS los registros recientes (últimos 60 días) y analiza con IA para encontrar coincidencias
- **Si aún no encuentras nada**: sugiere al usuario ampliar el rango de tiempo o verificar los nombres
- **CRÍTICO**: Para "anuncio ganador" o "mejor anuncio", SIEMPRE usar ventas/ROAS, NUNCA solo número de agendas
- **CRÍTICO**: Para ROAS, usar gasto de resumenes_diarios_ads o resumenes_diarios_creativos, NO buscar columna "gasto" en otras tablas
- **CRÍTICO**: Para reuniones de un closer, usar eventos_llamadas_tiempo_real donde closer = nombre, NO buscar en otras tablas

## FORMATO DE RESPUESTA - ⚠️ CRÍTICO

**REGLA DE ORO**: Si necesitas datos de la base de datos, genera DIRECTAMENTE el tool call JSON. NO expliques primero que vas a hacerlo. NO digas "Voy a consultar..." o "Necesito buscar...". Simplemente genera el JSON del tool call.

**Ejemplos CORRECTOS:**
- Usuario: "¿Cómo van las ventas esta semana?"
  → Respuesta: JSON con tool "sql_query" y parameters con query SQL
  (NO digas "Para responder necesito consultar...")

- Usuario: "Muéstrame un reporte de closers"
  → Respuesta: JSON con tool "generate_excel" y parameters
  (NO digas "Voy a generar un archivo...")

**Solo responde con texto natural si:**
- Puedes responder sin consultar datos (ej: explicar un concepto)
- Ya tienes los datos de una herramienta previa y estás analizándolos

**NUNCA combines explicación + tool call en la misma respuesta.**
- MAL: "Voy a consultar los datos..." seguido de tool call
- BIEN: Tool call JSON directamente, sin texto previo
`;

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════
export type AgentMessage = {
  role: "user" | "model" | "system";
  content: string;
  toolCall?: { name: string; args: Record<string, unknown> };
  toolResult?: { name: string; result: unknown };
};

type AgentStepResult = {
  text?: string;
  toolCall?: { name: string; args: Record<string, unknown> };
  thinking?: string;
};

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES DEL AGENTE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ejecuta un paso del agente con razonamiento
 */
export async function runAgentStep(
  history: AgentMessage[],
  idCuenta: number,
  timezone: string = "America/Bogota",
  lastToolResult?: unknown
): Promise<AgentStepResult> {
  // Construir el prompt con contexto actual
  const systemWithContext = SYSTEM_PROMPT.replace(/{ID_ACTUAL}/g, String(idCuenta))
    .replace(/{ID}/g, String(idCuenta))
    .replace(/{TIMEZONE}/g, timezone);

  // Serializar historial
  let conversationText = "";
  const userMessages: string[] = [];
  
  // Debug: verificar que el historial tiene mensajes
  console.log(`[Aura] Procesando historial con ${history.length} mensajes`);
  
  for (const msg of history) {
    if (msg.role === "user") {
      const content = (msg.content || "").trim();
      if (content) {
        console.log(`[Aura] Mensaje del usuario encontrado: "${content.slice(0, 50)}..."`);
        conversationText += `\n**Usuario:** ${content}\n`;
        userMessages.push(content);
      } else {
        console.warn(`[Aura] Mensaje del usuario vacío o sin contenido`);
      }
    }
    if (msg.role === "model") {
      if (msg.toolCall) {
        conversationText += `\n**Aura (Tool Call):** Ejecuté ${msg.toolCall.name}\n`;
      } else {
        const content = (msg.content || "").trim();
        if (content) {
          conversationText += `\n**Aura:** ${content}\n`;
        }
      }
    }
  }
  
  // Verificar que hay mensajes del usuario
  if (userMessages.length === 0) {
    console.error(`[Aura] ERROR: No se encontraron mensajes del usuario en el historial`);
  }

  // Si hay resultado de herramienta previa
  if (lastToolResult !== undefined) {
    const resultStr = JSON.stringify(lastToolResult, null, 2);
    // Truncar si es muy largo para no saturar el contexto
    const truncated = resultStr.length > 15000 
      ? resultStr.slice(0, 15000) + "\n... [RESULTADO TRUNCADO - " + resultStr.length + " caracteres totales]"
      : resultStr;
    conversationText += `\n**RESULTADO DE LA HERRAMIENTA:**\n\`\`\`json\n${truncated}\n\`\`\`\n`;
    conversationText += `\nAhora analiza estos datos y responde al usuario de forma clara y útil.\n`;
  }

  // Última pregunta del usuario (SIEMPRE incluirla si existe)
  const lastUserMsg = userMessages[userMessages.length - 1];
  if (lastUserMsg) {
    // Si ya está en el historial, no duplicar, pero asegurar que esté visible
    if (!conversationText.includes(lastUserMsg)) {
      conversationText += `\n**Pregunta actual del usuario:** ${lastUserMsg}\n`;
    }
  }

  // Instrucciones finales
  const finalInstruction = lastToolResult 
    ? (() => {
        const result = lastToolResult as { fallback?: boolean; noResults?: boolean; message?: string };
        if (result.fallback) {
          return `ANÁLISIS CON IA: ${result.message || ""}\n\nAnaliza TODOS los registros que recibiste y encuentra coincidencias con los nombres mencionados por el usuario (raul, raúl, blas, etc.). Compara variaciones de nombres (con/sin acentos, mayúsculas/minúsculas). Si encuentras coincidencias, preséntalas. Si NO encuentras nada, sugiere ampliar el rango de tiempo.`;
        }
        if (result.noResults) {
          return `NO HAY RESULTADOS: ${result.message || ""}\n\nResponde al usuario explicando que no encontré resultados en los últimos 60 días y sugiere que amplíe el rango de tiempo o verifique los nombres.`;
        }
        return "Responde al usuario basándote en los datos obtenidos. NO uses herramientas de nuevo a menos que sea estrictamente necesario.";
      })()
    : `
⚠️ INSTRUCCIÓN CRÍTICA: Si necesitas datos de la base de datos, responde EXCLUSIVAMENTE con el JSON del tool call. NO escribas explicaciones previas.

Ejemplo CORRECTO:
{ "tool": "sql_query", "parameters": { "query": "SELECT ...", "explanation": "..." } }

Ejemplo INCORRECTO (NO HACER):
"Para responder necesito consultar los datos. Voy a ejecutar la consulta ahora."
{ "tool": "sql_query", ... }

Si puedes responder sin consultar datos, hazlo en texto natural con formato Markdown.

IMPORTANTE: 
- id_cuenta actual = ${idCuenta}. SIEMPRE incluye este filtro en tus queries.
- Zona horaria del cliente = ${timezone}. Usa (fecha_hora_evento AT TIME ZONE '${timezone}')::date para filtrar fechas.
`;

  // Construir el prompt completo
  // Nota: generateWithGemini concatena systemPrompt + "-----\nTRANSCRIPCIÓN:\n" + userContent
  // Por eso pasamos el sistema como systemPrompt y la conversación como userContent
  const systemPrompt = `${systemWithContext}\n\n${finalInstruction}`;
  const userContent = conversationText || (lastUserMsg ? `**Usuario:** ${lastUserMsg}` : "El usuario necesita ayuda.");

  // Llamar al modelo
  let responseRaw = await generateWithGemini(systemPrompt, userContent);
  
  // Fallback a OpenAI si Gemini falla
  if (!responseRaw) {
    responseRaw = await generateWithOpenAI(systemPrompt, userContent);
  }

  if (!responseRaw) {
    return { text: "Lo siento, tuve un problema procesando tu solicitud. Por favor intenta de nuevo." };
  }

  const cleaned = responseRaw.trim();

  // Detectar JSON de Tool Call
  const jsonMatch = cleaned.match(/\{[\s\S]*"tool"[\s\S]*"parameters"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      // Limpiar bloques de código markdown
      const jsonStr = jsonMatch[0]
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      
      const parsed = JSON.parse(jsonStr);
      if (parsed.tool && parsed.parameters) {
        return { 
          toolCall: { name: parsed.tool, args: parsed.parameters as Record<string, unknown> },
          thinking: parsed.parameters.explanation as string | undefined
        };
      }
    } catch (e) {
      console.error("Error parseando tool call:", e);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DETECCIÓN DE INTENCIÓN DE TOOL CALL
  // Si el modelo dice que va a hacer algo pero no generó el tool call,
  // detectamos la intención y forzamos la generación
  // ═══════════════════════════════════════════════════════════════════════════
  const lowerCleaned = cleaned.toLowerCase();
  const hasToolIntent = 
    lowerCleaned.includes("voy a consultar") ||
    lowerCleaned.includes("necesito consultar") ||
    lowerCleaned.includes("voy a buscar") ||
    lowerCleaned.includes("necesito buscar") ||
    lowerCleaned.includes("voy a ejecutar") ||
    lowerCleaned.includes("necesito ejecutar") ||
    lowerCleaned.includes("consultar los datos") ||
    lowerCleaned.includes("buscar la información") ||
    (lowerCleaned.includes("sql") && lowerCleaned.includes("query")) ||
    (lowerCleaned.includes("base de datos") && (lowerCleaned.includes("consultar") || lowerCleaned.includes("buscar")));

  if (hasToolIntent && !lastToolResult) {
    console.log(`[Aura] Detectada intención de tool call pero no se generó JSON. Forzando regeneración.`);
    
    // Regenerar con instrucción más estricta
    const strictPrompt = `${systemWithContext}\n\n## CONVERSACIÓN\n${conversationText}\n\n⚠️ INSTRUCCIÓN URGENTE: El usuario necesita datos. Genera EXCLUSIVAMENTE el JSON del tool call sql_query. NO escribas texto explicativo. Solo el JSON:\n\n{ "tool": "sql_query", "parameters": { "query": "SELECT ...", "explanation": "..." } }`;
    
    const retryResponse = await generateWithGemini(strictPrompt, userContent);
    if (retryResponse) {
      const retryCleaned = retryResponse.trim();
      const retryJsonMatch = retryCleaned.match(/\{[\s\S]*"tool"[\s\S]*"parameters"[\s\S]*\}/);
      if (retryJsonMatch) {
        try {
          const retryJsonStr = retryJsonMatch[0]
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();
          const retryParsed = JSON.parse(retryJsonStr);
          if (retryParsed.tool && retryParsed.parameters) {
            console.log(`[Aura] Tool call generado correctamente en segundo intento.`);
            return { 
              toolCall: { name: retryParsed.tool, args: retryParsed.parameters as Record<string, unknown> },
              thinking: retryParsed.parameters.explanation as string | undefined
            };
          }
        } catch (e) {
          console.error("[Aura] Error parseando tool call en retry:", e);
        }
      }
    }
  }

  // Si no hay tool call, es respuesta directa
  return { text: cleaned };
}

/**
 * Ejecuta una consulta SQL de solo lectura
 */
export async function executeReadOnlySql(
  query: string, 
  _idCuenta: number, // Prefijo _ indica que es para referencia futura (RLS)
  params?: unknown[] // Parámetros opcionales para queries parametrizadas
): Promise<{ rows?: unknown[]; error?: string; rowCount?: number }> {
  const q = query.trim();
  
  // Validación de seguridad: solo SELECT o WITH (CTEs)
  const upperQ = q.toUpperCase();
  if (!upperQ.startsWith("SELECT") && !upperQ.startsWith("WITH")) {
    return { error: "Solo se permiten consultas SELECT de lectura." };
  }

  // Verificar que no haya comandos peligrosos
  const forbidden = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE", "CREATE", "GRANT", "REVOKE"];
  for (const cmd of forbidden) {
    // Buscar el comando como palabra completa (no parte de un nombre de columna)
    const regex = new RegExp(`\\b${cmd}\\b`, "i");
    if (regex.test(q)) {
      return { error: `Comando ${cmd} no permitido. Solo se permiten consultas de lectura.` };
    }
  }

  // Advertencia si no filtra por id_cuenta (pero no bloquear)
  if (!q.includes("id_cuenta")) {
    console.warn(`[Agent SQL] Query sin filtro id_cuenta: ${q.slice(0, 100)}...`);
  }

  try {
    const res = params ? await pool.query(q, params) : await pool.query(q);
    return { 
      rows: res.rows,
      rowCount: res.rowCount ?? 0
    };
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : "Error desconocido en la base de datos";
    console.error("[Agent SQL Error]", errorMsg);
    return { error: `Error SQL: ${errorMsg}` };
  }
}

/**
 * Genera datos para Excel a partir de resultados
 */
export function prepareExcelData(data: unknown[], sheetName: string = "Datos"): { 
  sheetName: string; 
  data: Record<string, unknown>[] 
}[] {
  if (!Array.isArray(data) || data.length === 0) {
    return [{ sheetName, data: [{ mensaje: "Sin datos disponibles" }] }];
  }
  return [{ sheetName, data: data as Record<string, unknown>[] }];
}

/**
 * Analiza texto de resumen_ia para extraer insights
 */
export function extractInsightsFromResumen(resumen: string): {
  fortalezas: string[];
  debilidades: string[];
  objeciones: string[];
} {
  const result = {
    fortalezas: [] as string[],
    debilidades: [] as string[],
    objeciones: [] as string[]
  };

  if (!resumen) return result;

  const lower = resumen.toLowerCase();

  // Buscar patrones comunes en los resúmenes
  if (lower.includes("excelente") || lower.includes("bien ejecutado") || lower.includes("fortaleza")) {
    result.fortalezas.push("Buen desempeño general identificado");
  }
  if (lower.includes("mejorar") || lower.includes("debilidad") || lower.includes("oportunidad")) {
    result.debilidades.push("Áreas de mejora identificadas");
  }
  if (lower.includes("objeción") || lower.includes("precio") || lower.includes("no tengo tiempo")) {
    result.objeciones.push("Objeciones detectadas en la llamada");
  }

  return result;
}
