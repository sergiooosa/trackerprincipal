import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { generateResumenIA, extractObjecionesIA, generateReporteMarketing } from "@/lib/ai";
import { readSession } from "@/lib/auth";

const PROMPT_RESUMEN = `# ANALIZADOR FORENSE UNIVERSAL DE CONVERSACIONES
(contenido abreviado)
Literalidad absoluta, no parafrasees.`;

const PROMPT_OBJECIONES = `Eres un analizador experto en objeciones. Devuelve SOLO JSON con el formato indicado.`;

const PROMPT_REPORTE = `Analista Senior de Estrategia. Devuelve el reporte en el formato numerado solicitado.`;

function isNumberLike(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

export async function POST(req: NextRequest) {
  const client = await pool.connect();
  try {
    // Requiere sesión activa
    const me = await readSession(req);
    if (!me) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const body = await req.json();
    const required = [
      "id_registro_agenda",
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
      "link_llamada",
      "transcripcion",
    ];
    for (const k of required) {
      if (body[k] === undefined || body[k] === null || body[k] === "") {
        return NextResponse.json({ error: `Falta el campo obligatorio: ${k}` }, { status: 400 });
      }
    }
    const id_registro_agenda = parseInt(String(body.id_registro_agenda), 10);
    const id_cuenta = parseInt(String(body.id_cuenta), 10);
    const tz = String(body.tz);
    const fecha_evento_local = String(body.fecha_evento_local);
    const closer = String(body.closer).trim();
    const correo_closer = String(body.correo_closer).trim();
    const cliente = String(body.cliente).trim();
    const email_lead = String(body.email_lead).trim();
    const categoriaRaw = String(body.categoria).toLowerCase().trim().replace(/\s+/g, "_");
    const cash_collected = Number(body.cash_collected);
    const facturacion = Number(body.facturacion);
    const anuncio_origen = String(body.anuncio_origen ?? "").toLowerCase().trim() || "organico";
    const link_llamada = String(body.link_llamada ?? "").trim();
    const transcripcion = String(body.transcripcion ?? "").trim();

    if (!Number.isInteger(id_registro_agenda) || !Number.isInteger(id_cuenta)) {
      return NextResponse.json({ error: "id_registro_agenda o id_cuenta inválidos" }, { status: 400 });
    }
    if (!isNumberLike(cash_collected) || !isNumberLike(facturacion)) {
      return NextResponse.json({ error: "cash_collected/facturacion inválidos" }, { status: 400 });
    }
    const categoria = ["ofertada", "no_ofertada", "cerrada"].includes(categoriaRaw) ? categoriaRaw : null;
    if (!categoria) {
      return NextResponse.json({ error: "categoria inválida" }, { status: 400 });
    }

    // IA
    const [resumen_ia, objeciones_ia, reportmarketing] = await Promise.all([
      generateResumenIA(PROMPT_RESUMEN, transcripcion),
      extractObjecionesIA(PROMPT_OBJECIONES, transcripcion),
      generateReporteMarketing(PROMPT_REPORTE, transcripcion),
    ]);

    await client.query("BEGIN");
    // Verificar y actualizar agenda (debe existir y pertenecer a la cuenta)
    const upd = await client.query(
      `
        UPDATE resumenes_diarios_agendas
        SET categoria = $1
        WHERE id_registro_agenda = $2
          AND id_cuenta = $3
        RETURNING id_registro_agenda
      `,
      [categoria, id_registro_agenda, id_cuenta]
    );
    if (upd.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Agenda no encontrada o no pertenece a la cuenta" }, { status: 404 });
    }

    // Insertar evento
    const insertSql = `
      INSERT INTO eventos_llamadas_tiempo_real
        (id_cuenta, fecha_hora_evento, closer, correo_closer, cliente, categoria, cash_collected, facturacion, resumen_ia, anuncio_origen, link_llamada, email_lead, objeciones_ia, reportmarketing)
      VALUES
        ($1, ($2::timestamp AT TIME ZONE $3), $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15)
      RETURNING id_evento
    `;
    const params = [
      id_cuenta,
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
    const ins = await client.query(insertSql, params);
    const id_evento = ins.rows?.[0]?.id_evento;
    await client.query("COMMIT");
    // Log
    try {
      const me = await readSession(req);
      await pool.query(
        `INSERT INTO historial_acciones (id_cuenta, usuario_asociado, accion, detalles)
         VALUES ($1,$2,$3,$4::jsonb)`,
        [id_cuenta, me?.nombre ?? "anon", "REVIVE_EVENT", JSON.stringify({ id_evento, id_registro_agenda })]
      );
    } catch {}
    return NextResponse.json({ id_evento }, { status: 201 });
  } catch (err: unknown) {
    await pool.query("ROLLBACK");
    const message = err instanceof Error ? err.message : "desconocido";
    return NextResponse.json({ error: `Error reviviendo no_show: ${message}` }, { status: 500 });
  } finally {
    client.release();
  }
}


