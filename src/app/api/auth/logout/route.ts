import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { clearSessionCookie, readSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  try {
    const me = await readSession(req);
    clearSessionCookie(res);
    if (me) {
      try {
        await pool.query(
          `INSERT INTO historial_acciones (id_cuenta, usuario_asociado, accion, detalles) VALUES ($1,$2,$3,$4::jsonb)`,
          [me.id_cuenta, me.nombre, "LOGOUT", JSON.stringify({})]
        );
      } catch {}
    }
  } catch {}
  return res;
}



