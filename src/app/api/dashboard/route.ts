import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // id_cuenta y zona horaria (por defecto Bogota)
    const idCuenta = parseInt(searchParams.get("id_cuenta") || "2", 10);
    const tz = searchParams.get("tz") || "America/Bogota";

    const fechaInicio = searchParams.get("fecha_inicio");
    const fechaFin = searchParams.get("fecha_fin");

    if (!fechaInicio || !fechaFin) {
      return NextResponse.json(
        { error: "Parámetros fecha_inicio y fecha_fin son requeridos" },
        { status: 400 }
      );
    }

    // Query principal reconstruida con precisión del 1000%
    const kpiQuery = `
      WITH parametros AS (
        SELECT 
          $1::int AS id_cuenta,
          $4::text AS zona,
          $2::date AS desde_fecha,
          $3::date AS hasta_fecha
      ),
      -- Eventos reales de llamadas (fuente principal de resultados)
      eventos_llamadas AS (
        SELECT
          COUNT(*) AS total_llamadas_tomadas,
          COUNT(*) FILTER (WHERE LOWER(categoria) IN ('ofertada', 'cerrada')) AS reuniones_calificadas,
          COUNT(*) FILTER (WHERE LOWER(categoria) = 'cerrada') AS llamadas_cerradas,
          SUM(cash_collected) AS cash_collected_total,
          SUM(facturacion) AS facturacion_total
        FROM eventos_llamadas_tiempo_real e
        JOIN parametros p ON e.id_cuenta = p.id_cuenta
        WHERE (e.fecha_hora_evento AT TIME ZONE p.zona)::date 
              BETWEEN p.desde_fecha AND p.hasta_fecha
      ),
      -- Datos de publicidad (fuente principal de inversión y agendamientos)
      datos_publicidad AS (
        SELECT
          SUM(gasto_total_ad) AS inversion_total,
          SUM(impresiones_totales) AS impresiones_totales,
          ROUND(AVG(ctr), 2) AS ctr_promedio,
          ROUND(AVG(play_rate), 2) AS vsl_play_rate,
          ROUND(AVG(engagement), 2) AS vsl_engagement,
          SUM(agendamientos) AS reuniones_agendadas
        FROM resumenes_diarios_ads a
        JOIN parametros p ON a.id_cuenta = p.id_cuenta
        WHERE a.fecha BETWEEN p.desde_fecha AND p.hasta_fecha
      )
      SELECT
        -- Métricas de Publicidad (desde resumenes_diarios_ads)
        COALESCE(d.inversion_total, 0.00) AS total_gasto_ads,
        COALESCE(d.impresiones_totales, 0) AS impresiones,
        COALESCE(d.ctr_promedio, 0.00) AS ctr,
        COALESCE(d.vsl_play_rate, 0.00) AS vsl_play_rate,
        COALESCE(d.vsl_engagement, 0.00) AS vsl_engagement,
        COALESCE(d.reuniones_agendadas, 0) AS reuniones_agendadas,
        
        -- Métricas de Llamadas (desde eventos_llamadas_tiempo_real)
        COALESCE(e.reuniones_calificadas, 0) AS reuniones_calificadas,
        COALESCE(e.total_llamadas_tomadas, 0) AS total_llamadas_tomadas,
        COALESCE(e.llamadas_cerradas, 0) AS total_cierres,
        COALESCE(e.facturacion_total, 0.00) AS total_facturacion,
        COALESCE(e.cash_collected_total, 0.00) AS cash_collected,

        -- KPIs Calculados con Precisión Absoluta
        -- Ticket Promedio: Facturación total / Cierres
        CASE 
          WHEN e.llamadas_cerradas > 0 THEN ROUND(e.facturacion_total / e.llamadas_cerradas, 2)
          ELSE 0
        END AS ticket_promedio,

        -- CAC: Inversión total / Cierres
        CASE 
          WHEN e.llamadas_cerradas > 0 THEN ROUND(d.inversion_total / e.llamadas_cerradas, 2)
          ELSE 0
        END AS cac,

        -- Costo por Agenda Calificada: Inversión / Reuniones Calificadas
        CASE 
          WHEN e.reuniones_calificadas > 0 THEN ROUND(d.inversion_total / e.reuniones_calificadas, 2)
          ELSE 0
        END AS costo_por_agenda_calificada,

        -- Costo por Show: Inversión / Llamadas Tomadas
        CASE 
          WHEN e.total_llamadas_tomadas > 0 THEN ROUND(d.inversion_total / e.total_llamadas_tomadas, 2)
          ELSE 0
        END AS costo_por_show,

        -- ROAS Facturación: Facturación / Inversión
        CASE 
          WHEN d.inversion_total > 0 THEN ROUND(e.facturacion_total / d.inversion_total, 2)
          ELSE 0
        END AS roas,
        
        -- ROAS Cash Collected: Cash Collected / Inversión
        CASE 
          WHEN d.inversion_total > 0 THEN ROUND(e.cash_collected_total / d.inversion_total, 2)
          ELSE 0
        END AS roas_cash_collected,

        -- No Show: Agendadas - Tomadas (solo si agendadas > tomadas)
        GREATEST(
          COALESCE(d.reuniones_agendadas, 0) - COALESCE(e.total_llamadas_tomadas, 0),
          0
        ) AS no_show

      FROM eventos_llamadas e
      LEFT JOIN datos_publicidad d ON TRUE;
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
      WHERE r.id_cuenta = $1 AND r.fecha BETWEEN $2::date AND $3::date
      ORDER BY r.fecha ASC;
    `;

    const closerQuery = `
      SELECT
        closer,
        COUNT(*) AS llamadas_tomadas,
        COUNT(*) FILTER (WHERE LOWER(categoria) = 'cerrada') AS cierres,
        SUM(facturacion) AS facturacion_generada,
        SUM(cash_collected) AS cash_collected,
        COUNT(*) FILTER (WHERE LOWER(categoria) IN ('ofertada', 'cerrada')) AS reuniones_calificadas,
        COUNT(*) FILTER (WHERE LOWER(categoria) LIKE '%show%' OR LOWER(categoria) = 'asistio') AS shows
      FROM eventos_llamadas_tiempo_real
      WHERE id_cuenta = $1 AND (fecha_hora_evento AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date
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
      WHERE id_cuenta = $1 AND (fecha_hora_evento AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date
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
      WHERE id_cuenta = $1 AND fecha BETWEEN $2::date AND $3::date;
    `;

    const callsKpisQuery = `
      SELECT
        COALESCE(SUM(llamadas_tomadas),0) AS reuniones_asistidas,
        COALESCE(SUM(llamadas_ofertadas),0) AS reuniones_calificadas,
        COALESCE(SUM(cierres),0) AS llamadas_cerradas,
        COALESCE(SUM(facturacion_total),0) AS facturacion,
        COALESCE(SUM(fees),0) AS fees
      FROM resumenes_diarios_llamadas
      WHERE id_cuenta = $1 AND fecha BETWEEN $2::date AND $3::date;
    `;

    const adsByOriginQuery = `
      WITH parametros AS (
        SELECT 
          $1::int AS id_cuenta,
          $4::text AS zona,
          $2::date AS desde_fecha,
          $3::date AS hasta_fecha
      ),
      -- Agendamientos por creativo (desde resumenes_diarios_creativos)
      agendamientos_creativos AS (
        SELECT
          origen AS creativo,
          COUNT(*) AS agendas
        FROM resumenes_diarios_creativos c
        JOIN parametros p ON c.id_cuenta = p.id_cuenta
        WHERE c.fecha BETWEEN p.desde_fecha AND p.hasta_fecha
        GROUP BY origen
      ),
      -- Gastos por creativo (desde resumenes_diarios_agendas)
      gastos_creativos AS (
        SELECT
          nombre_de_creativo AS creativo,
          SUM(gasto_total_creativo) AS gasto_total
        FROM resumenes_diarios_agendas a
        JOIN parametros p ON a.id_cuenta = p.id_cuenta
        WHERE a.fecha BETWEEN p.desde_fecha AND p.hasta_fecha
        GROUP BY nombre_de_creativo
      ),
      -- Resultados por creativo (desde eventos_llamadas_tiempo_real)
      resultados_creativos AS (
        SELECT
          anuncio_origen AS creativo,
          COUNT(*) AS shows,
          COUNT(*) FILTER (WHERE LOWER(categoria) = 'cerrada') AS cierres,
          SUM(facturacion) AS facturacion,
          SUM(cash_collected) AS cash_collected
        FROM eventos_llamadas_tiempo_real e
        JOIN parametros p ON e.id_cuenta = p.id_cuenta
        WHERE (e.fecha_hora_evento AT TIME ZONE p.zona)::date 
              BETWEEN p.desde_fecha AND p.hasta_fecha
        GROUP BY anuncio_origen
      ),
      -- Combinar todos los datos
      datos_completos AS (
        SELECT
          COALESCE(ac.creativo, gc.creativo, rc.creativo) AS creativo,
          COALESCE(ac.agendas, 0) AS agendas,
          COALESCE(rc.shows, 0) AS shows,
          COALESCE(rc.cierres, 0) AS cierres,
          COALESCE(rc.facturacion, 0) AS facturacion,
          COALESCE(rc.cash_collected, 0) AS cash_collected,
          COALESCE(gc.gasto_total, 0) AS gasto_total
        FROM agendamientos_creativos ac
        FULL OUTER JOIN gastos_creativos gc ON ac.creativo = gc.creativo
        FULL OUTER JOIN resultados_creativos rc ON COALESCE(ac.creativo, gc.creativo) = rc.creativo
      )
      SELECT
        creativo AS anuncio_origen,
        agendas,
        shows,
        cierres,
        facturacion,
        cash_collected,
        gasto_total AS spend_allocated
      FROM datos_completos
      WHERE creativo IS NOT NULL
      ORDER BY cierres DESC, facturacion DESC;
    `;

    // Resumen de HOY con manejo de zona horaria y anuncio más efectivo
    const hoyQuery = `
      WITH parametros AS (
        SELECT 
          $1::int AS id_cuenta,
          $2::text AS zona,
          (NOW() AT TIME ZONE $2)::date AS fecha_hoy
      ),
      eventos_hoy AS (
        SELECT
          COUNT(*) AS llamadas_tomadas,
          COUNT(*) FILTER (WHERE categoria IN ('Ofertada', 'Cerrada')) AS llamadas_calificadas,
          COUNT(*) FILTER (WHERE categoria = 'Cerrada') AS cierres,
          SUM(cash_collected) AS fees,
          SUM(facturacion) AS facturacion_real,
          (
            SELECT anuncio_origen
            FROM eventos_llamadas_tiempo_real e2
            JOIN parametros p2 ON e2.id_cuenta = p2.id_cuenta
            WHERE (e2.fecha_hora_evento AT TIME ZONE p2.zona)::date = p2.fecha_hoy
              AND facturacion > 0
            GROUP BY anuncio_origen
            ORDER BY COUNT(*) DESC
            LIMIT 1
          ) AS anuncio_mas_efectivo
        FROM eventos_llamadas_tiempo_real e
        JOIN parametros p ON e.id_cuenta = p.id_cuenta
        WHERE (e.fecha_hora_evento AT TIME ZONE p.zona)::date = p.fecha_hoy
      ),
      resumen_llamadas AS (
        SELECT
          llamadas_calendario,
          llamadas_canceladas,
          no_show,
          llamadas_ofertadas,
          fees AS fees_resumen,
          facturacion_total
        FROM resumenes_diarios_llamadas r
        JOIN parametros p ON r.id_cuenta = p.id_cuenta
        WHERE r.fecha = p.fecha_hoy
        LIMIT 1
      ),
      resumen_ads AS (
        SELECT
          gasto_total_ad,
          impresiones_totales,
          clicks_unicos,
          play_rate,
          engagement,
          cpm,
          cpc,
          ctr,
          agendamientos
        FROM resumenes_diarios_ads a
        JOIN parametros p ON a.id_cuenta = p.id_cuenta
        WHERE a.fecha = p.fecha_hoy
        LIMIT 1
      )
      SELECT
        p.fecha_hoy AS fecha,
        COALESCE(e.llamadas_tomadas, 0) AS llamadas_tomadas,
        COALESCE(e.llamadas_calificadas, 0) AS llamadas_calificadas,
        COALESCE(e.cierres, 0) AS cierres,
        COALESCE(e.fees, 0.00) AS fees_real,
        COALESCE(e.facturacion_real, 0.00) AS facturacion_real,
        COALESCE(e.anuncio_mas_efectivo, 'sin_datos') AS anuncio_mas_efectivo,
        COALESCE(r.llamadas_calendario, 0) AS llamadas_agendadas,
        COALESCE(r.llamadas_canceladas, 0) AS llamadas_canceladas,
        COALESCE(r.no_show, 0) AS no_show,
        COALESCE(r.llamadas_ofertadas, 0) AS llamadas_ofertadas,
        COALESCE(r.fees_resumen, 0.00) AS fees_resumen,
        COALESCE(r.facturacion_total, 0.00) AS facturacion_total,
        COALESCE(a.gasto_total_ad, 0.00) AS gasto_ads,
        COALESCE(a.impresiones_totales, 0) AS impresiones_totales,
        COALESCE(a.clicks_unicos, 0) AS clicks_unicos,
        COALESCE(a.play_rate, 0.00) AS play_rate,
        COALESCE(a.engagement, 0.00) AS engagement,
        COALESCE(a.cpm, 0.00) AS cpm,
        COALESCE(a.cpc, 0.00) AS cpc,
        COALESCE(a.ctr, 0.00) AS ctr,
        COALESCE(a.agendamientos, 0) AS agendamientos_ads
      FROM parametros p
      LEFT JOIN eventos_hoy e ON TRUE
      LEFT JOIN resumen_llamadas r ON TRUE
      LEFT JOIN resumen_ads a ON TRUE;
    `;

    const params3 = [idCuenta, fechaInicio, fechaFin];
    const params4 = [idCuenta, fechaInicio, fechaFin, tz];
    const hoyParams = [idCuenta, tz];

    const client = await pool.connect();
    try {
      const [kpiRes, seriesRes, closersRes, eventsRes, adsKpisRes, callsKpisRes, adsByOriginRes, hoyRes] = await Promise.all([
        client.query(kpiQuery, params4),
        client.query(seriesQuery, params3),
        client.query(closerQuery, params4),
        client.query(eventsQuery, params4),
        client.query(adsKpisQuery, params3),
        client.query(callsKpisQuery, params3),
        client.query(adsByOriginQuery, params4),
        client.query(hoyQuery, hoyParams),
      ]);

      const adsKpisRow = adsKpisRes.rows[0] ?? null;
      const callsKpisRow = callsKpisRes.rows[0] ?? null;
      const adsByOriginRows = adsByOriginRes.rows ?? [];
      const hoyRow = hoyRes.rows?.[0] ?? null;

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
        shows: number | string | null;
        cierres: number | string | null;
        facturacion: number | string | null;
        cash_collected: number | string | null;
        spend_allocated: number | string | null;
      };

      const adsByOrigin = (adsByOriginRows as AdsByOriginRow[]).map((r) => ({
        anuncio_origen: r.anuncio_origen,
        agendas: Number(r.agendas) || 0,
        shows: Number(r.shows) || 0,
        cierres: Number(r.cierres) || 0,
        facturacion: Number(r.facturacion) || 0,
        cash_collected: Number(r.cash_collected) || 0,
        spend_allocated: Number(r.spend_allocated) || 0,
      }));

      const hoy = hoyRow
        ? {
            fecha: hoyRow.fecha,
            llamadas_tomadas: Number(hoyRow.llamadas_tomadas) || 0,
            llamadas_calificadas: Number(hoyRow.llamadas_calificadas) || 0,
            cierres: Number(hoyRow.cierres) || 0,
            fees_real: Number(hoyRow.fees_real) || 0,
            facturacion_real: Number(hoyRow.facturacion_real) || 0,
            anuncio_mas_efectivo: String(hoyRow.anuncio_mas_efectivo || 'sin_datos'),
            llamadas_agendadas: Number(hoyRow.llamadas_agendadas) || 0,
            llamadas_canceladas: Number(hoyRow.llamadas_canceladas) || 0,
            no_show: Number(hoyRow.no_show) || 0,
            llamadas_ofertadas: Number(hoyRow.llamadas_ofertadas) || 0,
            fees_resumen: Number(hoyRow.fees_resumen) || 0,
            facturacion_total: Number(hoyRow.facturacion_total) || 0,
            gasto_ads: Number(hoyRow.gasto_ads) || 0,
            impresiones_totales: Number(hoyRow.impresiones_totales) || 0,
            clicks_unicos: Number(hoyRow.clicks_unicos) || 0,
            play_rate: Number(hoyRow.play_rate) || 0,
            engagement: Number(hoyRow.engagement) || 0,
            cpm: Number(hoyRow.cpm) || 0,
            cpc: Number(hoyRow.cpc) || 0,
            ctr: Number(hoyRow.ctr) || 0,
            agendamientos_ads: Number(hoyRow.agendamientos_ads) || 0,
          }
        : null;

      const kpiRow = kpiRes.rows[0] ?? {};
      
      return NextResponse.json({
        kpis: {
          total_facturacion: Number(kpiRow.total_facturacion) || 0,
          total_gasto_ads: Number(kpiRow.total_gasto_ads) || 0,
          total_llamadas_tomadas: Number(kpiRow.total_llamadas_tomadas) || 0,
          total_cierres: Number(kpiRow.total_cierres) || 0,
          impresiones: Number(kpiRow.impresiones) || 0,
          ctr: Number(kpiRow.ctr) || 0,
          vsl_play_rate: Number(kpiRow.vsl_play_rate) || 0,
          vsl_engagement: Number(kpiRow.vsl_engagement) || 0,
          reuniones_agendadas: Number(kpiRow.reuniones_agendadas) || 0,
          reuniones_calificadas: Number(kpiRow.reuniones_calificadas) || 0,
          cash_collected: Number(kpiRow.cash_collected) || 0,
          ticket_promedio: Number(kpiRow.ticket_promedio) || 0,
          cac: Number(kpiRow.cac) || 0,
          costo_por_agenda_calificada: Number(kpiRow.costo_por_agenda_calificada) || 0,
          costo_por_show: Number(kpiRow.costo_por_show) || 0,
          roas: Number(kpiRow.roas) || 0,
          roas_cash_collected: Number(kpiRow.roas_cash_collected) || 0,
          no_show: Number(kpiRow.no_show) || 0,
        },
        series: seriesRes.rows,
        closers: closersRes.rows,
        events: eventsRes.rows,
        adsKpis,
        callsKpis,
        adsByOrigin,
        hoy,
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
