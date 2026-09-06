// Portada de un capítulo: un JPEG chico que el reproductor captura del video
// y guarda en el bucket como art/<id>.jpg. GET lo devuelve (son decenas de
// KB, se cachea en el navegador); POST lo guarda y anota la fecha en marcas.

import { NextResponse, type NextRequest } from "next/server";
import { almacen, escribirJson, leerJson } from "@/lib/almacen";
import { COOKIE_SESION, leerConfig, verificarSesion } from "@/lib/auth";
import { buscar } from "@/lib/episodes";
import { conArte, KEY_MARCAS, keyArte, MAX_ARTE_BYTES, normalizarMarcas } from "@/lib/marcas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function conSesion(req: NextRequest): Promise<boolean> {
  const config = leerConfig();
  return !!(config.ok && (await verificarSesion(req.cookies.get(COOKIE_SESION)?.value, config.config)));
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await conSesion(req))) return new NextResponse("Sin sesión.", { status: 401 });
  const { id } = await params;
  if (!buscar(id)) return new NextResponse("Ese capítulo no existe.", { status: 404 });
  try {
    const datos = await almacen().leerBytes(keyArte(id));
    if (!datos) return new NextResponse("Sin portada.", { status: 404, headers: { "Cache-Control": "private, no-store" } });
    return new NextResponse(datos as BodyInit, {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400" },
    });
  } catch (e) {
    return new NextResponse(e instanceof Error ? e.message : "No pude leer la portada.", { status: 502 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await conSesion(req))) return NextResponse.json({ error: "Sin sesión." }, { status: 401 });
  const { id } = await params;
  if (!buscar(id)) return NextResponse.json({ error: "Ese capítulo no existe." }, { status: 404 });
  const datos = new Uint8Array(await req.arrayBuffer());
  if (datos.length < 1024 || datos.length > MAX_ARTE_BYTES) {
    return NextResponse.json({ error: `La portada tiene que pesar entre 1 KB y ${Math.round(MAX_ARTE_BYTES / 1024)} KB.` }, { status: 400 });
  }
  if (!(datos[0] === 0xff && datos[1] === 0xd8 && datos[2] === 0xff)) {
    return NextResponse.json({ error: "La portada tiene que ser un JPEG." }, { status: 400 });
  }
  try {
    const a = almacen();
    await a.escribirBytes(keyArte(id), datos, "image/jpeg");
    const version = Date.now();
    const marcas = conArte(normalizarMarcas(await leerJson(a, KEY_MARCAS)), id, version);
    await escribirJson(a, KEY_MARCAS, marcas);
    return NextResponse.json({ arte: version }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No pude guardar la portada." }, { status: 502 });
  }
}
