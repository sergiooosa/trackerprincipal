import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { runAgentStep, executeReadOnlySql, AgentMessage } from "@/lib/agent";
import * as XLSX from "xlsx";

const MAX_TOOL_ITERATIONS = 3; // Máximo de llamadas a herramientas en una conversación

export async function POST(req: NextRequest) {
  const me = await readSession(req);
  if (!me) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { messages } = body as { messages: AgentMessage[] };

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Formato de mensajes inválido" }, { status: 400 });
    }

    // Obtener zona horaria del cliente (server-side desde env)
    const timezone = process.env.NEXT_PUBLIC_CLIENT_TIMEZONE || "America/Bogota";

    // Limitar historial para no saturar el contexto
    const recentHistory = messages.slice(-20);

    // Ejecutar paso del agente con zona horaria
    let result = await runAgentStep(recentHistory, me.id_cuenta, timezone);
    let iterations = 0;

    // Loop de herramientas con límite
    while (result.toolCall && iterations < MAX_TOOL_ITERATIONS) {
      iterations++;
      const tool = result.toolCall;

      // ═══════════════════════════════════════════════════════════════════
      // HERRAMIENTA: sql_query
      // ═══════════════════════════════════════════════════════════════════
      if (tool.name === "sql_query") {
        const query = tool.args.query as string;
        const explanation = tool.args.explanation as string | undefined;
        
        console.log(`[Aura] Ejecutando SQL (iter ${iterations}):`, query.slice(0, 200));
        if (explanation) console.log(`[Aura] Razón:`, explanation);

        const sqlResult = await executeReadOnlySql(query, me.id_cuenta);

        if (sqlResult.error) {
          // Si hay error SQL, dejar que el agente lo maneje
          result = await runAgentStep(
            [...recentHistory, { role: "model", content: "", toolCall: tool }],
            me.id_cuenta,
            timezone,
            { error: sqlResult.error }
          );
        } else {
          // ═══════════════════════════════════════════════════════════════════
          // ESTRATEGIA DE BÚSQUEDA PERSISTENTE
          // ═══════════════════════════════════════════════════════════════════
          const rowCount = sqlResult.rowCount || 0;
          const rows = sqlResult.rows || [];

          // Si no encontró resultados Y es una búsqueda específica (contiene nombres o "llamada")
          const isSpecificSearch = query.toLowerCase().includes("cliente") || 
                                   query.toLowerCase().includes("closer") ||
                                   query.toLowerCase().includes("llamada") ||
                                   query.toLowerCase().includes("raúl") ||
                                   query.toLowerCase().includes("raul") ||
                                   query.toLowerCase().includes("blas");

          if (rowCount === 0 && isSpecificSearch && iterations === 1) {
            // Primera búsqueda falló: traer TODOS los registros recientes para análisis con IA
            console.log(`[Aura] Búsqueda específica sin resultados. Traeré todos los registros recientes para análisis.`);
            
            // Query de fallback: traer todos los registros recientes con parámetros seguros
            const fallbackQuery = `
              SELECT 
                id_evento,
                fecha_hora_evento,
                (fecha_hora_evento AT TIME ZONE $2)::timestamp as fecha_local,
                cliente,
                closer,
                categoria,
                cash_collected,
                facturacion,
                resumen_ia,
                objeciones_ia,
                link_llamada
              FROM eventos_llamadas_tiempo_real
              WHERE id_cuenta = $1
                AND (fecha_hora_evento AT TIME ZONE $2)::date >= CURRENT_DATE - INTERVAL '60 days'
              ORDER BY fecha_hora_evento DESC
              LIMIT 50
            `;

            const fallbackResult = await executeReadOnlySql(
              fallbackQuery, 
              me.id_cuenta,
              [me.id_cuenta, timezone] // Parámetros seguros
            );
            
            if (!fallbackResult.error && fallbackResult.rows && fallbackResult.rows.length > 0) {
              // Pasar todos los registros para que IA analice y encuentre coincidencias
              result = await runAgentStep(
                [...recentHistory, { role: "model", content: "", toolCall: tool }],
                me.id_cuenta,
                timezone,
                { 
                  rows: fallbackResult.rows,
                  rowCount: fallbackResult.rows.length,
                  query: query,
                  fallback: true,
                  message: "No encontré resultados con la búsqueda específica. Aquí están todos los registros recientes (últimos 60 días). Analiza estos datos y encuentra coincidencias con los nombres mencionados por el usuario."
                }
              );
            } else {
              // Ni siquiera hay registros recientes
              result = await runAgentStep(
                [...recentHistory, { role: "model", content: "", toolCall: tool }],
                me.id_cuenta,
                timezone,
                { 
                  rows: [],
                  rowCount: 0,
                  query: query,
                  noResults: true,
                  message: "No encontré resultados en los últimos 60 días. Sugiere al usuario que amplíe el rango de tiempo o verifique los nombres."
                }
              );
            }
          } else {
            // Resultados encontrados o no es búsqueda específica: análisis normal
            result = await runAgentStep(
              [...recentHistory, { role: "model", content: "", toolCall: tool }],
              me.id_cuenta,
              timezone,
              { 
                rows: rows,
                rowCount: rowCount,
                query: query
              }
            );
          }
        }
        continue;
      }

      // ═══════════════════════════════════════════════════════════════════
      // HERRAMIENTA: generate_excel
      // ═══════════════════════════════════════════════════════════════════
      if (tool.name === "generate_excel") {
        const filename = (tool.args.filename as string) || "reporte.xlsx";
        const sheets = tool.args.sheets as Array<{ sheetName: string; data: unknown[] }>;

        try {
          const wb = XLSX.utils.book_new();
          
          for (const sheet of sheets) {
            const sheetData = Array.isArray(sheet.data) ? sheet.data : [];
            const ws = XLSX.utils.json_to_sheet(sheetData as Record<string, unknown>[]);
            XLSX.utils.book_append_sheet(wb, ws, sheet.sheetName.slice(0, 31)); // Excel limita a 31 chars
          }
          
          const b64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" });

          return NextResponse.json({
            response: `✅ He generado el archivo **${filename}** con ${sheets.length} hoja(s). Haz clic en el enlace de abajo para descargarlo.`,
            file: {
              name: filename,
              content: b64,
              mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            }
          });
        } catch (excelError) {
          console.error("[Aura] Error generando Excel:", excelError);
          return NextResponse.json({
            response: "Hubo un error generando el archivo Excel. Por favor intenta de nuevo con menos datos."
          });
        }
      }

      // Herramienta desconocida
      console.warn(`[Aura] Herramienta desconocida: ${tool.name}`);
      break;
    }

    // Verificar si se alcanzó el límite de iteraciones
    if (iterations >= MAX_TOOL_ITERATIONS && result.toolCall) {
      console.warn("[Aura] Se alcanzó el límite de iteraciones de herramientas");
      return NextResponse.json({
        response: "He realizado múltiples consultas pero no pude obtener una respuesta completa. ¿Podrías reformular tu pregunta de forma más específica o indicarme un rango de fechas?"
      });
    }

    // Respuesta final
    return NextResponse.json({ 
      response: result.text || "No pude generar una respuesta. Por favor intenta de nuevo.",
      thinking: result.thinking // Opcional: mostrar razonamiento
    });

  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : "Error desconocido";
    console.error("[Aura Error]", errorMsg);
    return NextResponse.json(
      { error: "Error interno del asistente. Por favor intenta de nuevo." },
      { status: 500 }
    );
  }
}
