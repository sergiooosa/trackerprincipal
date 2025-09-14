import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Hardcode id_cuenta = 4 as requested
    const idCuenta = 4;

    const fechaInicio = searchParams.get("fecha_inicio");
    const fechaFin = searchParams.get("fecha_fin");

    if (!fechaInicio || !fechaFin) {
      return NextResponse.json(
        { error: "Parámetros fecha_inicio y fecha_fin son requeridos" },
        { status: 400 }
      );
    }

    // Queries
    const kpiQuery = `
      SELECT
        COALESCE(SUM(facturacion_total), 0) AS total_facturacion,
        (SELECT COALESCE(SUM(gasto_total_ad), 0) FROM resumenes_diarios_ads WHERE id_cuenta = $1 AND fecha BETWEEN $2 AND $3) AS total_gasto_ads,
        COALESCE(SUM(llamadas_tomadas), 0) AS total_llamadas_tomadas,
        COALESCE(SUM(cierres), 0) AS total_cierres
      FROM resumenes_diarios_llamadas
      WHERE id_cuenta = $1 AND fecha BETWEEN $2 AND $3;
    `;

    const seriesQuery = `
      SELECT
        r.fecha,
        COALESCE(r.facturacion_total, 0) AS facturacion,
        COALESCE(a.gasto_total_ad, 0) AS gasto_ads,
        COALESCE(r.llamadas_tomadas, 0) AS llamadas_tomadas,
        COALESCE(r.cierres, 0) AS cierres
      FROM resumenes_diarios_llamadas r
      LEFT JOIN resumenes_diarios_ads a ON r.fecha = a.fecha AND r.id_cuenta = a.id_cuenta
      WHERE r.id_cuenta = $1 AND r.fecha BETWEEN $2 AND $3
      ORDER BY r.fecha ASC;
    `;

    const closerQuery = `
      SELECT
        closer,
        COUNT(*) AS llamadas_tomadas,
        SUM(CASE WHEN cash_collected > 0 THEN 1 ELSE 0 END) AS cierres,
        SUM(facturacion) AS facturacion_generada
      FROM eventos_llamadas_tiempo_real
      WHERE id_cuenta = $1 AND fecha_hora_evento BETWEEN $2 AND $3
      GROUP BY closer
      ORDER BY facturacion_generada DESC;
    `;

    const eventsQuery = `
      SELECT
        id_evento,
        fecha_hora_evento,
        closer,
        facturacion,
        anuncio_origen,
        resumen_ia
      FROM eventos_llamadas_tiempo_real
      WHERE id_cuenta = $1 AND fecha_hora_evento BETWEEN $2 AND $3
      ORDER BY fecha_hora_evento DESC;
    `;

    const params = [idCuenta, fechaInicio, fechaFin];

    const client = await pool.connect();
    try {
      const [kpiRes, seriesRes, closersRes, eventsRes] = await Promise.all([
        client.query(kpiQuery, params),
        client.query(seriesQuery, params),
        client.query(closerQuery, params),
        client.query(eventsQuery, params),
      ]);

      return NextResponse.json({
        kpis: kpiRes.rows[0] ?? {
          total_facturacion: 0,
          total_gasto_ads: 0,
          total_llamadas_tomadas: 0,
          total_cierres: 0,
        },
        series: seriesRes.rows,
        closers: closersRes.rows,
        events: eventsRes.rows,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("/api/dashboard error", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
