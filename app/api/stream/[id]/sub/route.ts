// Subtítulos. A diferencia del video, acá sí se devuelven los bytes: un
// <track> sólo acepta archivos del mismo origen (o con CORS), así que un
// redirect a R2 lo bloquearía. Son archivos de decenas de KB.

import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, leerConfig, verificarSesion } from "@/lib/auth";
import { buscar } from "@/lib/episodes";
import { leerR2, pedirR2 } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const config = leerConfig();
  const sesion = config.ok ? await verificarSesion(req.cookies.get(COOKIE_SESION)?.value, config.config) : null;
  if (!sesion) return new NextResponse("Sin sesión.", { status: 401 });

  const { id } = await params;
  const ep = buscar(id);
  if (!ep || !ep.sub) return new NextResponse("Este capítulo no tiene subtítulos.", { status: 404 });

  const r2 = leerR2();
  if (!r2) {
    return NextResponse.redirect(new URL("/demo/muestra.vtt", req.url), 302);
  }

  const res = await pedirR2(r2, ep.sub);
  if (!res.ok || !res.body) {
    return new NextResponse(`No encontré ${ep.sub} en el bucket.`, { status: 404 });
  }
  return new NextResponse(res.body, {
    status: 200,
    headers: {
      "Content-Type": "text/vtt; charset=utf-8",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
