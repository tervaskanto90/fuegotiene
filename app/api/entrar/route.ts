import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, crearSesion, leerConfig, opcionesCookie, rutaSegura } from "@/lib/auth";

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

  const res = NextResponse.redirect(new URL(volverA, req.url), 303);
  res.cookies.set(COOKIE_SESION, token, opcionesCookie(process.env.NODE_ENV === "production"));
  return res;
}
