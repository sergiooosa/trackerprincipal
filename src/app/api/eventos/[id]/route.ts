import { NextResponse, NextRequest } from "next/server";
import pool from "@/lib/db";
import { readSession } from "@/lib/auth";

type PatchBody = {
  categoria?: string | null;
  cash_collected?: number | null;
  facturacion?: number | null;
};

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  // Requiere sesión activa
  const me = await readSession(req);
  if (!me) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await ctx.params;

  if (!id) {
    return NextResponse.json({ error: "Falta id del evento" }, { status: 400 });
  }

  let json: PatchBody;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const categoriaRaw = (json.categoria ?? null);
  const categoriaNorm = categoriaRaw
    ? String(categoriaRaw).toLowerCase().replace(/[_\s]+/g, " ").trim()
    : null;

  // Mapear a valores exactos en BD
  const categoriaFinal: string | null | undefined =
    categoriaNorm === null
      ? null
      : categoriaNorm === "no ofertada"
        ? "No_ofertada"
        : categoriaNorm === "ofertada"
          ? "Ofertada"
          : categoriaNorm === "cerrada"
            ? "Cerrada"
            : undefined; // si no coincide, no actualizamos la categoría

  const cash = typeof json.cash_collected === "number" ? json.cash_collected : json.cash_collected == null ? null : Number(json.cash_collected);
  const fact = typeof json.facturacion === "number" ? json.facturacion : json.facturacion == null ? null : Number(json.facturacion);

  // Construir SET dinámico en función de lo recibido (permitiendo null explícito)
  const setParts: string[] = [];
  const values: (string | number | null)[] = [id];

  if (categoriaFinal !== undefined) {
    setParts.push(`categoria = COALESCE($${values.length + 1}, categoria)`);
    values.push(categoriaFinal);
  }
  if (cash !== undefined) {
    setParts.push(`cash_collected = COALESCE($${values.length + 1}, cash_collected)`);
    values.push(cash);
  }
  if (fact !== undefined) {
    setParts.push(`facturacion = COALESCE($${values.length + 1}, facturacion)`);
    values.push(fact);
  }

  if (setParts.length === 0) {
    return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
  }

  const sql = `
    UPDATE eventos_llamadas_tiempo_real
    SET ${setParts.join(", ")}
    WHERE id_evento = $1
    RETURNING id_evento, categoria, cash_collected, facturacion;
  `;

  const client = await pool.connect();
  try {
    const res = await client.query(sql, values);
    if (!res.rowCount) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }
    try {
      const me = await readSession(req);
      await pool.query(
        `INSERT INTO historial_acciones (id_cuenta, usuario_asociado, accion, detalles)
         VALUES ($1,$2,$3,$4::jsonb)`,
        [null, me?.nombre ?? "anon", "UPDATE_EVENT", JSON.stringify({ id, fields: Object.keys(json || {}) })]
      );
    } catch {}
    return NextResponse.json({ ok: true, event: res.rows[0] });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    client.release();
  }
}


export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  // Requiere sesión activa
  const me = await readSession(req);
  if (!me) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Falta id del evento" }, { status: 400 });
  }
  const { searchParams } = new URL(req.url);
  const idCuentaStr = searchParams.get("id_cuenta");
  if (!idCuentaStr) {
    return NextResponse.json({ error: "Falta id_cuenta" }, { status: 400 });
  }
  const id_cuenta = parseInt(idCuentaStr, 10);
  if (!Number.isInteger(id_cuenta)) {
    return NextResponse.json({ error: "id_cuenta inválido" }, { status: 400 });
  }

  const sql = `
    DELETE FROM eventos_llamadas_tiempo_real
    WHERE id_evento = $1 AND id_cuenta = $2
  `;
  const client = await pool.connect();
  try {
    const res = await client.query(sql, [id, id_cuenta]);
    const count = typeof res.rowCount === "number" ? res.rowCount : 0;
    if (count === 0) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    try {
      const me = await readSession(req);
      await pool.query(
        `INSERT INTO historial_acciones (id_cuenta, usuario_asociado, accion, detalles)
         VALUES ($1,$2,$3,$4::jsonb)`,
        [id_cuenta, me?.nombre ?? "anon", "DELETE_EVENT", JSON.stringify({ id })]
      );
    } catch {}
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    client.release();
  }
}

