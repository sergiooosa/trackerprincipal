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

export async function GET(req: NextRequest) {
  const guard = await ensureSuperadmin(req);
  if ("error" in guard) return guard.error;
  const me = guard.me!;
  const { rows } = await pool.query(
    `SELECT id_evento, id_cuenta, nombre, rol, permisos, fathom, id_webhook_fathom
     FROM usuarios_dashboard
     WHERE id_cuenta = $1
     ORDER BY id_evento ASC`,
    [me.id_cuenta]
  );
  return NextResponse.json({ users: rows });
}

export async function POST(req: NextRequest) {
  const guard = await ensureSuperadmin(req);
  if ("error" in guard) return guard.error;
  const me = guard.me!;
  try {
    const body = await req.json();
    const nombre = String(body?.nombre ?? "").trim();
    const pass = String(body?.pass ?? "").trim();
    const rol = String(body?.rol ?? "usuario").trim().toLowerCase() === "superadmin" ? "superadmin" : "usuario";
    const permisos = rol === "superadmin" ? {} : (body?.permisos ?? {});
    const fathom_api_key = String(body?.fathom_api_key ?? "").trim();
    if (!nombre || !pass) {
      return NextResponse.json({ error: "nombre y pass son obligatorios" }, { status: 400 });
    }
    const hashed = await hashPassword(pass);

    // Webhook Fathom (opcional)
    let id_webhook_fathom: string | null = null;
    if (fathom_api_key && process.env.WEBHOOK_FATHOM) {
      // Revisar si ya existe para este id_cuenta con misma api key
      const existing = await pool.query(
        `SELECT 1 FROM usuarios_dashboard WHERE id_cuenta = $1 AND fathom = $2 LIMIT 1`,
        [me.id_cuenta, fathom_api_key]
      );
      if (existing.rowCount && existing.rowCount > 0) {
        id_webhook_fathom = "na";
      } else {
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
        if (!resp.ok) {
          const t = await resp.text().catch(() => "");
          return NextResponse.json({ error: `Fathom webhook error: ${resp.status} ${t}` }, { status: 400 });
        }
        const json = await resp.json().catch(() => ({}));
        id_webhook_fathom = String(json?.id || json?.webhook_id || "");
      }
    }

    const ins = await pool.query(
      `INSERT INTO usuarios_dashboard (id_cuenta, nombre, pass, rol, permisos, fathom, id_webhook_fathom)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)
       RETURNING id_evento`,
      [me.id_cuenta, nombre, hashed, rol, JSON.stringify(permisos || {}), fathom_api_key || null, id_webhook_fathom]
    );
    const createdId = ins.rows?.[0]?.id_evento;
    try {
      await pool.query(
        `INSERT INTO historial_acciones (id_cuenta, usuario_asociado, accion, detalles) VALUES ($1,$2,$3,$4::jsonb)`,
        [me.id_cuenta, me.nombre, "CREATE_USER", JSON.stringify({ target: nombre, rol })]
      );
    } catch {}
    return NextResponse.json({ id: createdId }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error creando usuario" }, { status: 500 });
  }
}


