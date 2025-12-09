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
    const pass = body?.pass ? String(body.pass).trim() : undefined;
    const fathom_api_key = body?.fathom_api_key !== undefined ? String(body.fathom_api_key).trim() : undefined;

    // Buscar estado actual para comparar Fathom
    const { rows: currentRows } = await pool.query(
      `SELECT fathom, id_webhook_fathom FROM usuarios_dashboard WHERE id_cuenta = $1 AND id_evento = $2`,
      [me.id_cuenta, id]
    );
    if (currentRows.length === 0) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    const current = currentRows[0];

    // Manejo de Fathom si cambió
    let newWebhookId: string | undefined = undefined;
    let updateFathom = false;

    if (fathom_api_key !== undefined && fathom_api_key !== (current.fathom || "")) {
      updateFathom = true;
      // 1. Borrar anterior si existía
      if (current.id_webhook_fathom && current.id_webhook_fathom !== "na" && current.fathom) {
        try {
          await fetch(`https://api.fathom.ai/external/v1/webhooks/${encodeURIComponent(current.id_webhook_fathom)}`, {
            method: "DELETE",
            headers: { "X-Api-Key": current.fathom },
          });
        } catch {}
      }
      
      // 2. Crear nuevo si hay key y tenemos URL destino
      if (fathom_api_key && process.env.WEBHOOK_FATHOM) {
        // Verificar unicidad básica (opcional, pero buena práctica)
        const existKey = await pool.query(
          `SELECT 1 FROM usuarios_dashboard WHERE id_cuenta = $1 AND fathom = $2 AND id_evento != $3 LIMIT 1`,
          [me.id_cuenta, fathom_api_key, id]
        );
        if (existKey.rowCount && existKey.rowCount > 0) {
          newWebhookId = "na"; // Ya usada en otro usuario
        } else {
          try {
            const resp = await fetch("https://api.fathom.ai/external/v1/webhooks", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Api-Key": fathom_api_key,
              },
              body: JSON.stringify({
                destination_url: process.env.WEBHOOK_FATHOM,
                triggered_for: ["my_recordings"],
                include_action_items: true,
                include_crm_matches: true,
                include_summary: true,
                include_transcript: true,
              }),
            });
            if (resp.ok) {
              const j = await resp.json();
              newWebhookId = String(j?.id || j?.webhook_id || "na");
            } else {
              // Si falla creación, no guardamos la key o guardamos sin webhook?
              // Decisión: guardamos key pero id_webhook "error" o undefined (lo dejaremos como null en SQL, aquí undefined no es válido si la variable es string | undefined)
              newWebhookId = undefined; 
            }
          } catch {
            newWebhookId = undefined;
          }
        }
      } else {
        newWebhookId = undefined; // Se borró la key
      }
    }

    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    if (rol) { sets.push(`rol = $${idx++}`); vals.push(rol); }
    if (permisos !== undefined) { sets.push(`permisos = $${idx++}::jsonb`); vals.push(JSON.stringify(permisos || {})); }
    if (pass) { const hashed = await hashPassword(pass); sets.push(`pass = $${idx++}`); vals.push(hashed); }
    if (updateFathom) {
      sets.push(`fathom = $${idx++}`); vals.push(fathom_api_key || null);
      sets.push(`id_webhook_fathom = $${idx++}`); vals.push(newWebhookId || null);
    }

    if (sets.length === 0) return NextResponse.json({ ok: true });

    vals.push(me.id_cuenta);
    vals.push(id);
    const sql = `UPDATE usuarios_dashboard SET ${sets.join(", ")} WHERE id_cuenta = $${idx++} AND id_evento = $${idx++}`;
    await pool.query(sql, vals);
    try {
      await pool.query(
        `INSERT INTO historial_acciones (id_cuenta, usuario_asociado, accion, detalles) VALUES ($1,$2,$3,$4::jsonb)`,
        [me.id_cuenta, me.nombre, "UPDATE_USER", JSON.stringify({ id, updatedFields: sets })]
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
