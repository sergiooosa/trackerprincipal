import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Permitir embedding en iframes si está configurado
  if (process.env.ALLOW_IFRAME === "true") {
    // Remover X-Frame-Options si existe (Next.js puede agregarlo por defecto)
    response.headers.delete("x-frame-options");
    
    // Agregar Content-Security-Policy que permite embedding
    // Permitir embedding desde cualquier origen (ajusta según necesites)
    const csp = response.headers.get("content-security-policy") || "";
    if (!csp.includes("frame-ancestors")) {
      response.headers.set(
        "Content-Security-Policy",
        `frame-ancestors *; ${csp}`
      );
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};

