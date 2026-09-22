// Puerta de acceso. Corre en Edge, antes de cualquier página o ruta.
// /api/stream/[id] vuelve a validar la sesión y el pase por su cuenta: es la
// única ruta que expone URLs firmadas y no queremos que dependa de este archivo.

import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_PASE, COOKIE_SESION, leerConfig, verificarPase, verificarSesion } from "@/lib/auth";

const PUBLICAS = [/^\/entrar$/, /^\/api\/entrar$/, /^\/api\/salir$/, /^\/demo\//, /^\/robots\.txt$/];

/**
 * Lo que se puede usar con sesión pero sin haber pasado el juego: el juego
 * mismo y las dos secciones de leer. Todo lo demás pide el pase, incluidos
 * los capítulos, el reproductor y las pantallas de mantenimiento. Es una
 * lista blanca a propósito: una ruta nueva nace protegida.
 */
const SIN_PASE = [/^\/juego$/, /^\/api\/simulacro$/, /^\/expediente$/, /^\/origen$/];

/**
 * Las pantallas de mantenimiento, sólo para los códigos de CODIGOS_DUENO.
 * Pasar el juego abre los capítulos, no el bucket: nadie más tiene por qué
 * poder subir archivos ni ver qué hay adentro.
 *
 * `/api/estado/[id]` queda afuera de esta lista a propósito: es el
 * diagnóstico de un capítulo y el reproductor lo usa para explicar en
 * palabras por qué un video no anda, en la pantalla de cualquiera.
 */
const SOLO_DUENO = [/^\/subir$/, /^\/estado$/, /^\/api\/subir$/, /^\/api\/estado$/];

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

  if (!sesion) {
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

  if (SOLO_DUENO.some((r) => r.test(pathname)) && !sesion.dueno) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Esa pantalla es del dueño del sitio." }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (SIN_PASE.some((r) => r.test(pathname))) return NextResponse.next();

  // Los códigos de CODIGOS_LIBRES entran a los capítulos sin jugar.
  if (sesion.libre) return NextResponse.next();

  const pase = config.ok
    ? await verificarPase(req.cookies.get(COOKIE_PASE)?.value, sesion.id, config.config)
    : null;
  if (pase !== null) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Todavía no pasaste el juego." }, { status: 403 });
  }
  return NextResponse.redirect(new URL("/juego?puerta=1", req.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
