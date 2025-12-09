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

**PASO 2 - PLANIFICAR**: ¿Qué datos necesito?
- Identificar las tablas relevantes
- Pensar qué filtros aplicar (fechas, closer, creativo)
- Decidir si necesito una query o varias

**PASO 3 - EJECUTAR**: Generar la consulta SQL
- Solo SELECT, nunca modificar datos
- Siempre incluir WHERE id_cuenta = {ID_ACTUAL}
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

### Resumen de performance por closer (últimos 30 días)
SELECT closer,
  COUNT(*) as llamadas,
  COUNT(*) FILTER (WHERE categoria = 'cerrada') as cierres,
  SUM(facturacion) as facturacion_total,
  ROUND(COUNT(*) FILTER (WHERE categoria = 'cerrada')::decimal / NULLIF(COUNT(*), 0) * 100, 1) as close_rate
FROM eventos_llamadas_tiempo_real
WHERE id_cuenta = {ID} AND fecha_hora_evento >= NOW() - INTERVAL '30 days'
GROUP BY closer ORDER BY cierres DESC;

### Objeciones más frecuentes (analizando resumen_ia)
SELECT closer, resumen_ia FROM eventos_llamadas_tiempo_real
WHERE id_cuenta = {ID} AND resumen_ia IS NOT NULL AND resumen_ia != ''
ORDER BY fecha_hora_evento DESC LIMIT 10;
(Luego analiza el texto de resumen_ia para extraer patrones)

### Creativos con mejor performance
SELECT COALESCE(NULLIF(origen, ''), 'organico') as creativo,
  COUNT(*) as agendas,
  COUNT(*) FILTER (WHERE categoria IN ('Cerrada','Ofertada','No_Ofertada')) as asistieron
FROM resumenes_diarios_agendas
WHERE id_cuenta = {ID}
GROUP BY 1 ORDER BY asistieron DESC;

## FORMATO DE RESPUESTA

- Usa Markdown para formatear (negritas, listas, tablas cuando sea útil)
- Si el usuario pide un archivo, usa generate_excel
- Si necesitas datos, usa sql_query
- Si puedes responder directamente (ej: explicar un concepto), hazlo sin herramientas
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
  lastToolResult?: unknown
): Promise<AgentStepResult> {
  // Construir el prompt con contexto actual
  const systemWithContext = SYSTEM_PROMPT.replace(/{ID_ACTUAL}/g, String(idCuenta))
    .replace(/{ID}/g, String(idCuenta));

  // Serializar historial
  let conversationText = "";
  for (const msg of history) {
    if (msg.role === "user") {
      conversationText += `\n**Usuario:** ${msg.content}\n`;
    }
    if (msg.role === "model") {
      if (msg.toolCall) {
        conversationText += `\n**Aura (Tool Call):** Ejecuté ${msg.toolCall.name}\n`;
      } else {
        conversationText += `\n**Aura:** ${msg.content}\n`;
      }
    }
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

  // Última pregunta del usuario
  const lastUserMsg = history.filter(m => m.role === "user").pop();
  if (lastUserMsg && !lastToolResult) {
    conversationText += `\n**Pregunta actual:** ${lastUserMsg.content}\n`;
  }

  // Instrucciones finales
  const finalInstruction = lastToolResult 
    ? "Responde al usuario basándote en los datos obtenidos. NO uses herramientas de nuevo a menos que sea estrictamente necesario."
    : `
Responde a la pregunta del usuario. Si necesitas datos de la base de datos, responde SOLO con el JSON de la herramienta.
Si puedes responder directamente, hazlo en texto natural con formato Markdown.
IMPORTANTE: id_cuenta actual = ${idCuenta}. SIEMPRE incluye este filtro en tus queries.
`;

  const fullPrompt = `${systemWithContext}\n\n## CONVERSACIÓN\n${conversationText}\n\n${finalInstruction}`;

  // Llamar al modelo
  let responseRaw = await generateWithGemini(fullPrompt, "");
  
  // Fallback a OpenAI si Gemini falla
  if (!responseRaw) {
    responseRaw = await generateWithOpenAI(fullPrompt, "");
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

  // Si no hay tool call, es respuesta directa
  return { text: cleaned };
}

/**
 * Ejecuta una consulta SQL de solo lectura
 */
export async function executeReadOnlySql(
  query: string, 
  _idCuenta: number // Prefijo _ indica que es para referencia futura (RLS)
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
    const res = await pool.query(q);
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
