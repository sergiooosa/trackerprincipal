import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { attachSessionCookie, createSession, verifyPassword, SessionUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const clave = String(body?.clave ?? "").trim();
    const remember = Boolean(body?.remember ?? false);
    if (!clave) {
      return NextResponse.json({ error: "Falta clave" }, { status: 400 });
    }
    const envIdCuenta = parseInt(process.env.NEXT_PUBLIC_CLIENT_ID || "0", 10);
    if (!envIdCuenta) {
      return NextResponse.json({ error: "Falta NEXT_PUBLIC_CLIENT_ID" }, { status: 500 });
    }
    // Superadmin via env (bootstrap)
    if (process.env.SUPERADMIN_PASS && clave === process.env.SUPERADMIN_PASS) {
      const user: SessionUser = {
        id_evento: 0,
        id_cuenta: envIdCuenta,
        nombre: "superadmin",
        rol: "superadmin",
        permisos: null,
      };
      const token = await createSession(user, remember);
      const res = NextResponse.json({ ok: true, user });
      attachSessionCookie(res, token, remember);
      // Registrar acción
      try {
        await pool.query(
          `INSERT INTO historial_acciones (id_cuenta, usuario_asociado, accion, detalles) VALUES ($1,$2,$3,$4::jsonb)`,
          [envIdCuenta, user.nombre, "LOGIN", JSON.stringify({ rol: "superadmin_env" })]
        );
      } catch {}
      return res;
    }
    // Buscar usuario en DB por id_cuenta y comparar pass (hash)
    const { rows } = await pool.query(
      `SELECT id_evento, id_cuenta, nombre, pass, rol, permisos
       FROM usuarios_dashboard
       WHERE id_cuenta = $1`,
      [envIdCuenta]
    );
    for (const row of rows) {
      const okHash = row.pass ? await verifyPassword(clave, row.pass) : false;
      const okPlain = !row.pass ? false : false; // no permitir plain por seguridad
      if (okHash || okPlain) {
        const user: SessionUser = {
          id_evento: row.id_evento,
          id_cuenta: row.id_cuenta,
          nombre: row.nombre,
          rol: (row.rol === "superadmin" ? "superadmin" : "usuario"),
          permisos: row.permisos || null,
        };
        const token = await createSession(user, remember);
        const res = NextResponse.json({ ok: true, user });
        attachSessionCookie(res, token, remember);
        try {
          await pool.query(
            `INSERT INTO historial_acciones (id_cuenta, usuario_asociado, accion, detalles) VALUES ($1,$2,$3,$4::jsonb)`,
            [envIdCuenta, user.nombre, "LOGIN", JSON.stringify({ rol: user.rol })]
          );
        } catch {}
        return res;
      }
    }
    return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
  } catch {
    return NextResponse.json({ error: "Error en login" }, { status: 500 });
  }
}


