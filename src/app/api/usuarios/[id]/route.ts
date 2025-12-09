import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { readSession, hashPassword } from "@/lib/auth";

async function ensureSuperadmin(req: NextRequest) {
  const me = await readSession(req);
  if (!me || me.rol !== "superadmin") {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }
  return { me };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await ensureSuperadmin(req);
  if ("error" in guard) return guard.error;
  const me = guard.me!;
  const p = await params;
  const id = parseInt(p.id, 10);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "id inválido" }, { status: 400 });
  try {
    const body = await req.json();
    const rol = body?.rol ? (String(body.rol).toLowerCase() === "superadmin" ? "superadmin" : "usuario") : undefined;
    const permisos = body?.permisos !== undefined ? body.permisos : undefined;
    const pass = body?.pass ? String(body.pass) : undefined;
    const fathom_api_key = body?.fathom_api_key ? String(body.fathom_api_key) : undefined;

    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    if (rol) { sets.push(`rol = $${idx++}`); vals.push(rol); }
    if (permisos !== undefined) { sets.push(`permisos = $${idx++}::jsonb`); vals.push(JSON.stringify(permisos || {})); }
    if (pass) { const hashed = await hashPassword(pass); sets.push(`pass = $${idx++}`); vals.push(hashed); }
    if (fathom_api_key !== undefined) { sets.push(`fathom = $${idx++}`); vals.push(fathom_api_key || null); }
    if (sets.length === 0) return NextResponse.json({ ok: true });

    vals.push(me.id_cuenta);
    vals.push(id);
    const sql = `UPDATE usuarios_dashboard SET ${sets.join(", ")} WHERE id_cuenta = $${idx++} AND id_evento = $${idx++}`;
    await pool.query(sql, vals);
    try {
      await pool.query(
        `INSERT INTO historial_acciones (id_cuenta, usuario_asociado, accion, detalles) VALUES ($1,$2,$3,$4::jsonb)`,
        [me.id_cuenta, me.nombre, "UPDATE_USER", JSON.stringify({ id })]
      );
    } catch {}
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error actualizando usuario" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await ensureSuperadmin(req);
  if ("error" in guard) return guard.error;
  const me = guard.me!;
  const p = await params;
  const id = parseInt(p.id, 10);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "id inválido" }, { status: 400 });
  try {
    // Buscar webhook para eliminarlo si existe
    const { rows } = await pool.query(
      `SELECT id_webhook_fathom, fathom FROM usuarios_dashboard WHERE id_cuenta = $1 AND id_evento = $2 LIMIT 1`,
      [me.id_cuenta, id]
    );
    const webhookId = rows?.[0]?.id_webhook_fathom;
    const apiKey = rows?.[0]?.fathom;
    if (webhookId && webhookId !== "na" && apiKey) {
      try {
        await fetch(`https://api.fathom.ai/external/v1/webhooks/${encodeURIComponent(webhookId)}`, {
          method: "DELETE",
          headers: { "X-Api-Key": apiKey },
        });
      } catch {}
    }
    await pool.query(
      `DELETE FROM usuarios_dashboard WHERE id_cuenta = $1 AND id_evento = $2`,
      [me.id_cuenta, id]
    );
    try {
      await pool.query(
        `INSERT INTO historial_acciones (id_cuenta, usuario_asociado, accion, detalles) VALUES ($1,$2,$3,$4::jsonb)`,
        [me.id_cuenta, me.nombre, "DELETE_USER", JSON.stringify({ id })]
      );
    } catch {}
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Error eliminando usuario" }, { status: 500 });
  }
}


