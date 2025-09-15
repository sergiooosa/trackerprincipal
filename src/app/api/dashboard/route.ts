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
        cliente,
        categoria,
        cash_collected,
        facturacion,
        anuncio_origen,
        resumen_ia
      FROM eventos_llamadas_tiempo_real
      WHERE id_cuenta = $1 AND fecha_hora_evento BETWEEN $2 AND $3
      ORDER BY fecha_hora_evento DESC;
    `;

    const adsKpisQuery = `
      SELECT
        COALESCE(SUM(gasto_total_ad),0) AS spend,
        COALESCE(SUM(impresiones_totales),0) AS impresiones,
        COALESCE(SUM(clicks_unicos),0) AS clicks,
        CASE WHEN COALESCE(SUM(impresiones_totales),0)=0 THEN 0
             ELSE (COALESCE(SUM(clicks_unicos),0)::decimal / SUM(impresiones_totales)) * 100
        END AS ctr_pct,
        COALESCE(AVG(play_rate),0) AS vsl_play_rate,
        COALESCE(AVG(engagement),0) AS vsl_engagement,
        COALESCE(SUM(agendamientos),0) AS reuniones_agendadas
      FROM resumenes_diarios_ads
      WHERE id_cuenta = $1 AND fecha BETWEEN $2 AND $3;
    `;

    const callsKpisQuery = `
      SELECT
        COALESCE(SUM(llamadas_tomadas),0) AS reuniones_asistidas,
        COALESCE(SUM(llamadas_ofertadas),0) AS reuniones_calificadas,
        COALESCE(SUM(cierres),0) AS llamadas_cerradas,
        COALESCE(SUM(facturacion_total),0) AS facturacion,
        COALESCE(SUM(fees),0) AS fees
      FROM resumenes_diarios_llamadas
      WHERE id_cuenta = $1 AND fecha BETWEEN $2 AND $3;
    `;

    const adsByOriginQuery = `
      WITH e AS (
        SELECT
          anuncio_origen,
          COUNT(*) AS agendas,
          SUM(CASE WHEN facturacion > 0 THEN 1 ELSE 0 END) AS cierres,
          SUM(facturacion) AS facturacion,
          SUM(cash_collected) AS cash_collected
        FROM eventos_llamadas_tiempo_real
        WHERE id_cuenta = $1 AND fecha_hora_evento BETWEEN $2 AND $3
        GROUP BY anuncio_origen
      ), tot AS (
        SELECT COALESCE(SUM(agendas),0) AS total_agendas FROM e
      ), spend AS (
        SELECT COALESCE(SUM(gasto_total_ad),0) AS total_spend
        FROM resumenes_diarios_ads WHERE id_cuenta = $1 AND fecha BETWEEN $2 AND $3
      )
      SELECT
        e.anuncio_origen,
        e.agendas,
        e.cierres,
        e.facturacion,
        e.cash_collected,
        CASE WHEN tot.total_agendas = 0 THEN 0
             ELSE spend.total_spend * (e.agendas::decimal / tot.total_agendas)
        END AS spend_allocated
      FROM e, tot, spend
      ORDER BY e.cierres DESC, e.facturacion DESC;
    `;

    const params = [idCuenta, fechaInicio, fechaFin];

    const client = await pool.connect();
    try {
      const [kpiRes, seriesRes, closersRes, eventsRes, adsKpisRes, callsKpisRes, adsByOriginRes] = await Promise.all([
        client.query(kpiQuery, params),
        client.query(seriesQuery, params),
        client.query(closerQuery, params),
        client.query(eventsQuery, params),
        client.query(adsKpisQuery, params),
        client.query(callsKpisQuery, params),
        client.query(adsByOriginQuery, params),
      ]);

      const adsKpisRow = adsKpisRes.rows[0] ?? null;
      const callsKpisRow = callsKpisRes.rows[0] ?? null;
      const adsByOriginRows = adsByOriginRes.rows ?? [];

      const adsKpis = adsKpisRow
        ? {
            spend: Number(adsKpisRow.spend) || 0,
            impresiones: Number(adsKpisRow.impresiones) || 0,
            clicks: Number(adsKpisRow.clicks) || 0,
            ctr_pct: Number(adsKpisRow.ctr_pct) || 0,
            vsl_play_rate: Number(adsKpisRow.vsl_play_rate) || 0,
            vsl_engagement: Number(adsKpisRow.vsl_engagement) || 0,
            reuniones_agendadas: Number(adsKpisRow.reuniones_agendadas) || 0,
          }
        : null;

      const callsKpis = callsKpisRow
        ? {
            reuniones_asistidas: Number(callsKpisRow.reuniones_asistidas) || 0,
            reuniones_calificadas: Number(callsKpisRow.reuniones_calificadas) || 0,
            llamadas_cerradas: Number(callsKpisRow.llamadas_cerradas) || 0,
            facturacion: Number(callsKpisRow.facturacion) || 0,
            fees: Number(callsKpisRow.fees) || 0,
          }
        : null;

      type AdsByOriginRow = {
        anuncio_origen: string;
        agendas: number | string | null;
        cierres: number | string | null;
        facturacion: number | string | null;
        cash_collected: number | string | null;
        spend_allocated: number | string | null;
      };

      const adsByOrigin = (adsByOriginRows as AdsByOriginRow[]).map((r) => ({
        anuncio_origen: r.anuncio_origen,
        agendas: Number(r.agendas) || 0,
        cierres: Number(r.cierres) || 0,
        facturacion: Number(r.facturacion) || 0,
        cash_collected: Number(r.cash_collected) || 0,
        spend_allocated: Number(r.spend_allocated) || 0,
      }));

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
        adsKpis,
        callsKpis,
        adsByOrigin,
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
