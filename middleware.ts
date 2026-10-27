// La puerta del sitio. Corre en Edge, antes de cualquier página o ruta.
//
// Al sitio se entra sin nada: cualquiera que llegue ve el juego y el origen.
// Los capítulos y el expediente se abren cuando se gana el juego, y lo que
// acredita eso es la cookie del pase. Los códigos de acceso ya no son la
// entrada: sirven para saltearse el juego (CODIGOS_LIBRES) o para llegar al
// mantenimiento (CODIGOS_DUENO).
//
// Las reglas —qué es público, qué es del dueño, qué pide el pase— están en
// `lib/puerta.ts` (`decidirPuerta`), que no importa nada y se testea solo.
// Acá sólo se leen las cookies y se traduce la decisión a una respuesta.
//
// /api/stream/[id] vuelve a validar el pase por su cuenta: es la única ruta
// que expone URLs firmadas y no queremos que dependa de este archivo.

import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_PASE, COOKIE_SESION, leerConfig, verificarPase, verificarSesion } from "@/lib/auth";
import { decidirPuerta } from "@/lib/puerta";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const config = leerConfig();
  const sesion = config.ok
    ? await verificarSesion(req.cookies.get(COOKIE_SESION)?.value, config.config)
    : null;

  const decision = await decidirPuerta(pathname, sesion, async () =>
    config.ok ? (await verificarPase(req.cookies.get(COOKIE_PASE)?.value, config.config)) !== null : false,
  );

  switch (decision.tipo) {
    case "pasa":
      return NextResponse.next();
    case "redirige":
      return NextResponse.redirect(new URL(decision.a, req.url));
    case "rechaza":
      return NextResponse.json({ error: decision.error }, { status: 403 });
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
