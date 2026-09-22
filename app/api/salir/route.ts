// Cierra la sesión del código y devuelve a la portada.
//
// **No toca la cookie del pase**, a propósito: el pase es lo que la persona
// se ganó jugando y no tiene nada que ver con haber entrado con un código.
// Borrarlo acá hacía que alguien que ganó el juego, tocara salir y volviera
// a estar afuera, teniendo que jugar de nuevo. Salir cierra la sesión, no te
// quita la entrada.
//
// Y devuelve a "/" y no a /entrar: con el pase puesto ahí están los
// capítulos, y sin él el middleware lleva al juego. Mandar a la pantalla del
// código a alguien que quizá nunca tuvo uno no tiene sentido.

import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.delete(COOKIE_SESION);
  return res;
}
