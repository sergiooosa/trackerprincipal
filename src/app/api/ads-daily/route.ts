import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import pool from "@/lib/db";

// GET: Obtener datos diarios de ads para un rango de fechas
export async function GET(req: NextRequest) {
  const me = await readSession(req);
  if (!me) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const fechaInicio = searchParams.get("fecha_inicio");
    const fechaFin = searchParams.get("fecha_fin");
    const campo = searchParams.get("campo"); // 'gasto_total_ad', 'impresiones_totales', 'play_rate', 'engagement'

    if (!fechaInicio || !fechaFin || !campo) {
      return NextResponse.json(
        { error: "fecha_inicio, fecha_fin y campo son requeridos" },
        { status: 400 }
      );
    }

    const camposValidos = ['gasto_total_ad', 'impresiones_totales', 'play_rate', 'engagement', 'ctr'];
    if (!camposValidos.includes(campo)) {
      return NextResponse.json(
        { error: "Campo inválido. Debe ser uno de: " + camposValidos.join(', ') },
        { status: 400 }
      );
    }

    // Generar todas las fechas del rango (incluso si no hay datos)
    const start = new Date(fechaInicio);
    const end = new Date(fechaFin);
    const todasLasFechas: string[] = [];
    const current = new Date(start);
    while (current <= end) {
      todasLasFechas.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    // Obtener datos existentes
    const query = `
      SELECT 
        fecha::text as fecha,
        COALESCE(${campo}, 0) as valor
      FROM resumenes_diarios_ads
      WHERE id_cuenta = $1
        AND fecha BETWEEN $2::date AND $3::date
      ORDER BY fecha ASC
    `;

    const result = await pool.query(query, [me.id_cuenta, fechaInicio, fechaFin]);
    
    // Normalizar fechas a formato YYYY-MM-DD para comparación
    const datosExistentes = new Map<string, number>();
    for (const row of result.rows) {
      // La fecha viene como string en formato YYYY-MM-DD (por el ::text)
      const fechaStr = String(row.fecha).split('T')[0];
      const valor = row.valor !== null && row.valor !== undefined ? Number(row.valor) : 0;
      datosExistentes.set(fechaStr, valor);
    }

    // Combinar: todas las fechas con sus valores (0 si no existe)
    const datos = todasLasFechas.map(fecha => ({
      fecha,
      valor: datosExistentes.get(fecha) ?? 0
    }));

    return NextResponse.json({ datos });
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : "Error desconocido";
    console.error("[API Ads Daily GET]", errorMsg);
    return NextResponse.json(
      { error: "Error al obtener datos diarios" },
      { status: 500 }
    );
  }
}

// PATCH: Actualizar datos diarios de ads
export async function PATCH(req: NextRequest) {
  const me = await readSession(req);
  if (!me) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { campo, cambios } = body as {
      campo: string;
      cambios: Array<{ fecha: string; valor: number }>;
    };

    const camposValidos = ['gasto_total_ad', 'impresiones_totales', 'play_rate', 'engagement', 'ctr'];
    if (!camposValidos.includes(campo)) {
      return NextResponse.json(
        { error: "Campo inválido" },
        { status: 400 }
      );
    }

    if (!Array.isArray(cambios) || cambios.length === 0) {
      return NextResponse.json(
        { error: "Debe proporcionar al menos un cambio" },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const cambiosRegistrados: Array<{ fecha: string; valor_anterior: number; valor_nuevo: number }> = [];

      for (const cambio of cambios) {
        // Obtener valor anterior
        const selectQuery = `
          SELECT ${campo} as valor_anterior
          FROM resumenes_diarios_ads
          WHERE id_cuenta = $1 AND fecha = $2::date
        `;
        const selectResult = await client.query(selectQuery, [me.id_cuenta, cambio.fecha]);
        
        const valorAnterior = selectResult.rows[0]?.valor_anterior ?? 0;

        // Usar UPSERT: INSERT si no existe, UPDATE si existe
        // Intentar con ON CONFLICT primero, si falla usar INSERT/UPDATE separado
        try {
          const upsertQuery = `
            INSERT INTO resumenes_diarios_ads (id_cuenta, fecha, ${campo})
            VALUES ($1, $2::date, $3)
            ON CONFLICT (id_cuenta, fecha) 
            DO UPDATE SET ${campo} = EXCLUDED.${campo}
          `;
          await client.query(upsertQuery, [me.id_cuenta, cambio.fecha, cambio.valor]);
        } catch (conflictError) {
          // Si ON CONFLICT falla (no hay constraint), usar INSERT/UPDATE manual
          const checkQuery = `SELECT 1 FROM resumenes_diarios_ads WHERE id_cuenta = $1 AND fecha = $2::date`;
          const checkResult = await client.query(checkQuery, [me.id_cuenta, cambio.fecha]);
          
          if (checkResult.rows.length > 0) {
            // Actualizar
            const updateQuery = `UPDATE resumenes_diarios_ads SET ${campo} = $3 WHERE id_cuenta = $1 AND fecha = $2::date`;
            await client.query(updateQuery, [me.id_cuenta, cambio.fecha, cambio.valor]);
          } else {
            // Insertar (solo el campo que estamos editando, otros campos quedan NULL)
            const insertQuery = `INSERT INTO resumenes_diarios_ads (id_cuenta, fecha, ${campo}) VALUES ($1, $2::date, $3)`;
            await client.query(insertQuery, [me.id_cuenta, cambio.fecha, cambio.valor]);
          }
        }

        cambiosRegistrados.push({
          fecha: cambio.fecha,
          valor_anterior: Number(valorAnterior),
          valor_nuevo: cambio.valor
        });
      }

      // Registrar en historial_acciones
      const nombreCampo = {
        'gasto_total_ad': 'Inversión en publicidad',
        'impresiones_totales': 'Impresiones',
        'play_rate': 'VSL PLAY RATE %',
        'engagement': 'VSL ENGAGEMENT %',
        'ctr': 'CTR %'
      }[campo] || campo;

      const detallesLog = {
        campo: nombreCampo,
        cambios: cambiosRegistrados.map(c => ({
          fecha: c.fecha,
          antes: c.valor_anterior,
          despues: c.valor_nuevo
        }))
      };

      await client.query(
        `INSERT INTO historial_acciones (id_cuenta, usuario_asociado, accion, detalles)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [
          me.id_cuenta,
          me.nombre || 'Usuario',
          'EDITAR_METRICA_ADS',
          JSON.stringify(detallesLog)
        ]
      );

      await client.query("COMMIT");

      return NextResponse.json({
        success: true,
        mensaje: `Se actualizaron ${cambios.length} registro(s)`,
        cambios: cambiosRegistrados
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : "Error desconocido";
    console.error("[API Ads Daily PATCH]", errorMsg);
    return NextResponse.json(
      { error: "Error al actualizar datos" },
      { status: 500 }
    );
  }
}

