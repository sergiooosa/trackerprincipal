import { NextResponse, NextRequest } from "next/server";
import pool from "@/lib/db";

type PatchBody = {
  categoria?: string | null;
  cash_collected?: number | null;
  facturacion?: number | null;
};

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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
  const categoria = categoriaRaw
    ? String(categoriaRaw).toLowerCase().trim()
    : null;

  // Solo permitir las 3 opciones pedidas
  const allowed = new Set(["no ofertada", "ofertada", "cerrada"]);
  const categoriaFinal = categoria && allowed.has(categoria) ? categoria : categoria === null ? null : undefined;

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
    return NextResponse.json({ ok: true, event: res.rows[0] });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    client.release();
  }
}


