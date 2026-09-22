// La puerta del sitio. Corre en Edge, antes de cualquier página o ruta.
//
// Al sitio se entra sin nada: cualquiera que llegue ve el juego y el origen.
// Los capítulos y el expediente se abren cuando se gana el juego, y lo que
// acredita eso es la cookie del pase. Los códigos de acceso ya no son la
// entrada: sirven para saltearse el juego (CODIGOS_LIBRES) o para llegar al
// mantenimiento (CODIGOS_DUENO).
//
// /api/stream/[id] vuelve a validar el pase por su cuenta: es la única ruta
// que expone URLs firmadas y no queremos que dependa de este archivo.

import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_PASE, COOKIE_SESION, leerConfig, verificarPase, verificarSesion } from "@/lib/auth";

/**
 * Lo que ve alguien que entra por primera vez, sin código y sin haber jugado:
 * el juego, que es la puerta, y el origen, que cuenta por qué existe esto.
 * Más el login, para quien tiene un código.
 */
const PUBLICAS = [
  /^\/juego$/,
  /^\/origen$/,
  /^\/api\/simulacro$/,
  /^\/entrar$/,
  /^\/api\/entrar$/,
  /^\/api\/salir$/,
  /^\/demo\//,
  /^\/robots\.txt$/,
];

/**
 * Las pantallas de mantenimiento, sólo para los códigos de CODIGOS_DUENO.
 * Ganar el juego abre los capítulos, no el bucket.
 *
 * `/api/estado/[id]` queda afuera de esta lista a propósito: es el
 * diagnóstico de un capítulo y el reproductor lo usa para explicar en
 * palabras por qué un video no anda, en la pantalla de cualquiera.
 */
const SOLO_DUENO = [/^\/subir$/, /^\/estado$/, /^\/api\/subir$/, /^\/api\/estado$/];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const config = leerConfig();
  const sesion = config.ok
    ? await verificarSesion(req.cookies.get(COOKIE_SESION)?.value, config.config)
    : null;

  if (PUBLICAS.some((r) => r.test(pathname))) {
    if (pathname === "/entrar" && sesion) return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }

  if (SOLO_DUENO.some((r) => r.test(pathname))) {
    if (sesion?.dueno) return NextResponse.next();
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Esa pantalla es del dueño del sitio." }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Todo lo demás —capítulos, reproductor, expediente— pide el juego ganado.
  // Los códigos de CODIGOS_LIBRES y CODIGOS_DUENO se lo saltean.
  if (sesion?.libre) return NextResponse.next();
  const pase = config.ok ? await verificarPase(req.cookies.get(COOKIE_PASE)?.value, config.config) : null;
  if (pase) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Todavía no pasaste el juego." }, { status: 403 });
  }
  return NextResponse.redirect(new URL("/juego", req.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
