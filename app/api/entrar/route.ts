import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_PASE, COOKIE_SESION, crearPase, crearSesion, leerConfig, opcionesCookie, rutaSegura } from "@/lib/auth";
import { puntajeParaEntrar } from "@/lib/puerta";
import { paseGuardado } from "@/lib/pases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const codigo = String(form.get("codigo") ?? "").trim();
  const volverA = rutaSegura(form.get("a"));

  const config = leerConfig();
  if (!config.ok) {
    return NextResponse.redirect(new URL("/entrar", req.url), 303);
  }

  const token = await crearSesion(codigo, config.config);
  if (!token) {
    // Un respiro para que probar códigos al azar sea lento.
    await new Promise((r) => setTimeout(r, 600));
    const destino = new URL("/entrar", req.url);
    destino.searchParams.set("error", "1");
    if (volverA !== "/") destino.searchParams.set("a", volverA);
    return NextResponse.redirect(destino, 303);
  }

  const opciones = opcionesCookie(process.env.NODE_ENV === "production");
  const res = NextResponse.redirect(new URL(volverA, req.url), 303);
  res.cookies.set(COOKIE_SESION, token, opciones);

  // Si esta persona ya pasó el juego alguna vez, el pase la estaba esperando
  // en el bucket: no lo tiene que ganar de nuevo por cambiar de navegador.
  const id = token.split(".")[1];
  const previo = await paseGuardado(id);
  if (previo && previo.puntaje >= puntajeParaEntrar()) {
    res.cookies.set(COOKIE_PASE, await crearPase(id, previo.puntaje, config.config), opciones);
  }
  return res;
}
