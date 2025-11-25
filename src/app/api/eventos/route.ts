import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { generateResumenIA, extractObjecionesIA, generateReporteMarketing } from "@/lib/ai";

const PROMPT_RESUMEN = `# ANALIZADOR FORENSE UNIVERSAL DE CONVERSACIONES
## SISTEMA DE TRANSCRIPCIÓN LITERAL Y ANÁLISIS CONVERSACIONAL V4.0
(contenido abreviado) 
Usa literalidad absoluta, no parafrasees. Mantén citas exactas.`;

const PROMPT_OBJECIONES = `Eres un analizador experto en identificar EXCLUSIVAMENTE objeciones de venta...
FORMATO ESTRICTO:
[
  {
    "objeciones": [
      { "objecion": "texto exacto de la objeción", "categoria": "categoria correspondiente" }
    ]
  }
]
(contenido abreviado)`;

const PROMPT_REPORTE = `Eres un Analista Senior de Estrategia de Ventas y Psicología del Consumidor...
Sigue el formato numerado solicitado, sin saludos.`;

function isNumberLike(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const required = [
      "id_cuenta",
      "tz",
      "fecha_evento_local",
      "closer",
      "correo_closer",
      "cliente",
      "email_lead",
      "categoria",
      "cash_collected",
      "facturacion",
      "anuncio_origen",
      "nota_meta",
      "link_llamada",
      "transcripcion",
    ];
    for (const k of required) {
      if (body[k] === undefined || body[k] === null || body[k] === "") {
        return NextResponse.json({ error: `Falta el campo obligatorio: ${k}` }, { status: 400 });
      }
    }

    const id_cuenta = parseInt(String(body.id_cuenta), 10);
    const tz = String(body.tz);
    const fecha_evento_local = String(body.fecha_evento_local); // ej: 2025-11-25T10:30
    const closer = String(body.closer).trim();
    const correo_closer = String(body.correo_closer).trim();
    const cliente = String(body.cliente).trim();
    const email_lead = String(body.email_lead).trim();
    const categoriaRaw = String(body.categoria).toLowerCase().trim().replace(/\s+/g, "_");
    const cash_collected = Number(body.cash_collected);
    const facturacion = Number(body.facturacion);
    const anuncio_origen = String(body.anuncio_origen ?? "").toLowerCase().trim() || "organico";
    const nota_meta = String(body.nota_meta ?? "").toLowerCase().trim();
    const link_llamada = String(body.link_llamada ?? "").trim();
    const transcripcion = String(body.transcripcion ?? "").trim();

    if (!Number.isInteger(id_cuenta)) {
      return NextResponse.json({ error: "id_cuenta inválido" }, { status: 400 });
    }
    if (!isNumberLike(cash_collected) || !isNumberLike(facturacion)) {
      return NextResponse.json({ error: "cash_collected/facturacion inválidos" }, { status: 400 });
    }
    const categoria = ["ofertada", "no_ofertada", "cerrada"].includes(categoriaRaw) ? categoriaRaw : null;
    if (!categoria) {
      return NextResponse.json({ error: "categoria inválida" }, { status: 400 });
    }

    // IA (fall-back: Gemini -> OpenAI -> vacío)
    const [resumen_ia, objeciones_ia, reportmarketing] = await Promise.all([
      generateResumenIA(PROMPT_RESUMEN, transcripcion),
      extractObjecionesIA(PROMPT_OBJECIONES, transcripcion),
      generateReporteMarketing(PROMPT_REPORTE, transcripcion),
    ]);

    // Insertar en DB
    // Convertir fecha local + tz a timestamptz en UTC
    // Usamos: ( $1::timestamp AT TIME ZONE $2 )
    const insertSql = `
      INSERT INTO eventos_llamadas_tiempo_real
        (id_cuenta, fecha_hora_evento, closer, correo_closer, cliente, categoria, cash_collected, facturacion, resumen_ia, anuncio_origen, link_llamada, email_lead, objeciones_ia, reportmarketing)
      VALUES
        ($1, ($2::timestamp AT TIME ZONE $3), $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15)
      RETURNING id_evento
    `;
    const params = [
      id_cuenta,
      // asegurar segundos para parseo
      fecha_evento_local.length === 16 ? `${fecha_evento_local}:00` : fecha_evento_local,
      tz,
      closer,
      correo_closer,
      cliente,
      categoria,
      cash_collected,
      facturacion,
      resumen_ia ?? "",
      anuncio_origen || "organico",
      link_llamada,
      email_lead,
      JSON.stringify(objeciones_ia ?? { objeciones: [] }),
      reportmarketing ?? "",
    ];
    const result = await pool.query(insertSql, params);
    const id_evento = result.rows?.[0]?.id_evento;
    return NextResponse.json({ id_evento }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: `Error creando evento: ${err?.message || "desconocido"}` }, { status: 500 });
  }
}


