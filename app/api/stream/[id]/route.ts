// Firma una URL de R2 y devuelve un 302. El navegador le pide los bytes
// directo a R2, con sus Range requests. Esta ruta NUNCA debe leer el objeto
// y devolverlo: rompe el seek y quema ancho de banda de Vercel.
//
// Vuelve a validar el pase del juego aunque el middleware ya lo haya hecho:
// es la única ruta que expone URLs firmadas.

import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_PASE, COOKIE_SESION, leerConfig, verificarPase, verificarSesion } from "@/lib/auth";
import { buscar } from "@/lib/episodes";
import { firmarUrl, leerR2 } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIN_CACHE = { "Cache-Control": "private, no-store" };

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const config = leerConfig();
  if (!config.ok) {
    return NextResponse.json({ error: "El sitio está sin configurar." }, { status: 401, headers: SIN_CACHE });
  }
  const sesion = await verificarSesion(req.cookies.get(COOKIE_SESION)?.value, config.config);
  const pase =
    sesion?.libre || (await verificarPase(req.cookies.get(COOKIE_PASE)?.value, config.config)) !== null;
  if (!pase) {
    return NextResponse.json(
      { error: "Todavía no pasaste el juego." },
      { status: 403, headers: SIN_CACHE },
    );
  }

  // Esta URL es para que la pida el reproductor, no para pegarla en la barra de
  // direcciones y guardar el archivo. Los navegadores dicen para qué piden cada
  // cosa: "video" o "audio" es un <video>, "document" es alguien abriéndola a mano.
  // Los que no mandan el dato (Safari viejo) pasan igual: acá no se rechaza a ciegas.
  const paraQue = req.headers.get("sec-fetch-dest");
  if (paraQue === "document" || paraQue === "iframe" || paraQue === "object") {
    return NextResponse.json(
      { error: "Los capítulos se miran desde el sitio." },
      { status: 403, headers: SIN_CACHE },
    );
  }

  const { id } = await params;
  const ep = buscar(id);
  if (!ep) {
    return NextResponse.json({ error: "Ese capítulo no existe." }, { status: 404, headers: SIN_CACHE });
  }

  const r2 = leerR2();
  if (!r2) {
    return NextResponse.redirect(new URL("/demo/muestra.mp4", req.url), { status: 302, headers: SIN_CACHE });
  }

  const url = await firmarUrl(r2, ep.key);
  return NextResponse.redirect(url, { status: 302, headers: SIN_CACHE });
}
