// Puerta de acceso. Corre en Edge, antes de cualquier página o ruta.
// /api/stream/[id] vuelve a validar la sesión por su cuenta: es la única
// ruta que expone URLs firmadas y no queremos que dependa de este archivo.

import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, leerConfig, verificarSesion } from "@/lib/auth";

const PUBLICAS = [/^\/entrar$/, /^\/api\/entrar$/, /^\/api\/salir$/, /^\/demo\//, /^\/robots\.txt$/];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const publica = PUBLICAS.some((r) => r.test(pathname));

  const config = leerConfig();
  const token = req.cookies.get(COOKIE_SESION)?.value;
  const sesion = config.ok ? await verificarSesion(token, config.config) : null;

  if (publica) {
    if (pathname === "/entrar" && sesion) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (sesion) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sin sesión. Entrá con tu código." }, { status: 401 });
  }

  const destino = new URL("/entrar", req.url);
  const volverA = pathname + search;
  if (volverA !== "/") destino.searchParams.set("a", volverA);
  const res = NextResponse.redirect(destino);
  if (token) res.cookies.delete(COOKIE_SESION);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|art/).*)"],
};
