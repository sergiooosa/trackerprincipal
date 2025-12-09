import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

export type SessionUser = {
  id_evento: number;
  id_cuenta: number;
  nombre: string;
  rol: "superadmin" | "usuario";
  permisos?: Record<string, unknown> | null;
};

const COOKIE_NAME = "session_token";
const ONE_DAY_SECONDS = 60 * 60 * 24;
const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("Falta SESSION_SECRET en variables de entorno");
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(plain: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(plain, saltRounds);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

export async function createSession(user: SessionUser, remember: boolean = false): Promise<string> {
  const expiration = remember ? `${THIRTY_DAYS_SECONDS}s` : `${ONE_DAY_SECONDS}s`;
  const jwt = await new SignJWT(user as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiration)
    .sign(getSecret());
  return jwt;
}

export async function readSession(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export function attachSessionCookie(
  res: NextResponse, 
  token: string, 
  remember: boolean = false,
  req?: NextRequest
) {
  const isProd = process.env.NODE_ENV === "production";
  const maxAge = remember ? THIRTY_DAYS_SECONDS : ONE_DAY_SECONDS;
  
  // Detectar si está en un iframe o contexto embebido
  const isEmbedded = 
    process.env.ALLOW_IFRAME === "true" ||
    req?.headers.get("sec-fetch-dest") === "iframe" ||
    req?.headers.get("x-frame-options") !== null;
  
  // Si está embebido, usar sameSite: "none" y secure: true (requisito del navegador)
  // Si no está embebido, usar sameSite: "lax" para mejor seguridad
  const sameSite = isEmbedded ? ("none" as const) : ("lax" as const);
  const secure = isEmbedded ? true : isProd; // En iframes siempre secure: true
  
  res.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: sameSite,
    secure: secure,
    maxAge: maxAge,
    path: "/",
  });
}

export function clearSessionCookie(res: NextResponse, req?: NextRequest) {
  const isEmbedded = 
    process.env.ALLOW_IFRAME === "true" ||
    req?.headers.get("sec-fetch-dest") === "iframe" ||
    req?.headers.get("x-frame-options") !== null;
  
  const sameSite = isEmbedded ? ("none" as const) : ("lax" as const);
  const secure = isEmbedded ? true : (process.env.NODE_ENV === "production");
  
  res.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: sameSite,
    secure: secure,
    maxAge: 0,
    path: "/",
  });
}



