import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { readSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const me = await readSession(req);
  if (!me || me.rol !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10), 1000);
  const { rows } = await pool.query(
    `SELECT id_evento, id_cuenta, usuario_asociado, accion, detalles, fecha_y_hora_evento
     FROM historial_acciones
     WHERE id_cuenta = $1
     ORDER BY fecha_y_hora_evento DESC
     LIMIT $2`,
    [me.id_cuenta, Number.isFinite(limit) ? limit : 200]
  );
  return NextResponse.json({ logs: rows });
}


