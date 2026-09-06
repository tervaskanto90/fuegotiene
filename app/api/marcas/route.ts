// Anotaciones por capítulo (intro, portada). GET las devuelve todas; POST
// cambia la intro de un capítulo y reescribe marcas.json en el bucket.

import { NextResponse, type NextRequest } from "next/server";
import { almacen, escribirJson, leerJson } from "@/lib/almacen";
import { COOKIE_SESION, leerConfig, verificarSesion } from "@/lib/auth";
import { buscar } from "@/lib/episodes";
import { conIntro, KEY_MARCAS, normalizarMarcas, validarIntro } from "@/lib/marcas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIN_CACHE = { "Cache-Control": "private, no-store" };

async function conSesion(req: NextRequest): Promise<boolean> {
  const config = leerConfig();
  return !!(config.ok && (await verificarSesion(req.cookies.get(COOKIE_SESION)?.value, config.config)));
}

export async function GET(req: NextRequest) {
  if (!(await conSesion(req))) return NextResponse.json({ error: "Sin sesión." }, { status: 401 });
  try {
    const marcas = normalizarMarcas(await leerJson(almacen(), KEY_MARCAS));
    return NextResponse.json(marcas, { headers: SIN_CACHE });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No pude leer las anotaciones." }, { status: 502, headers: SIN_CACHE });
  }
}

export async function POST(req: NextRequest) {
  if (!(await conSesion(req))) return NextResponse.json({ error: "Sin sesión." }, { status: 401 });
  let cuerpo: { id?: unknown; intro?: unknown };
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido mal armado." }, { status: 400 });
  }
  const id = typeof cuerpo.id === "string" ? cuerpo.id : "";
  if (!buscar(id)) return NextResponse.json({ error: "Ese capítulo no existe." }, { status: 404 });
  let intro: [number, number] | null = null;
  if (cuerpo.intro !== null && cuerpo.intro !== undefined) {
    intro = validarIntro(cuerpo.intro);
    if (!intro) {
      return NextResponse.json({ error: "La intro tiene que ser un principio y un final en segundos, el final después del principio y a lo sumo 10 minutos." }, { status: 400 });
    }
  }
  try {
    const a = almacen();
    const marcas = conIntro(normalizarMarcas(await leerJson(a, KEY_MARCAS)), id, intro);
    await escribirJson(a, KEY_MARCAS, marcas);
    return NextResponse.json(marcas, { headers: SIN_CACHE });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No pude guardar." }, { status: 502, headers: SIN_CACHE });
  }
}
