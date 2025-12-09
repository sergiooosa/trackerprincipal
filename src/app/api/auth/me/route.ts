import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  // Logs detallados para debugging
  const cookieHeader = req.headers.get("cookie");
  const hasSessionCookie = cookieHeader?.includes("session_token");
  
  console.log(`[Auth/me] Request recibido`);
  console.log(`[Auth/me] Cookie header presente: ${!!cookieHeader}`);
  console.log(`[Auth/me] Tiene session_token: ${hasSessionCookie}`);
  console.log(`[Auth/me] Cookie header (primeros 200 chars): ${cookieHeader?.substring(0, 200)}`);
  console.log(`[Auth/me] Referer: ${req.headers.get("referer")}`);
  console.log(`[Auth/me] Origin: ${req.headers.get("origin")}`);
  console.log(`[Auth/me] Sec-Fetch-Dest: ${req.headers.get("sec-fetch-dest")}`);
  
  const me = await readSession(req);
  
  if (!me) {
    console.log(`[Auth/me] No se encontró sesión válida - retornando user: null`);
    return NextResponse.json({ user: null }, { status: 200 });
  }
  
  console.log(`[Auth/me] Sesión válida encontrada - usuario: ${me.nombre}, rol: ${me.rol}`);
  return NextResponse.json({ user: me }, { status: 200 });
}



