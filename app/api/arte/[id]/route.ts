// Portada de un capítulo: un JPEG chico que el reproductor captura del video
// y guarda en el bucket como art/<id>.jpg. GET lo devuelve (son decenas de
// KB, se cachea en el navegador); POST lo guarda y anota la fecha en marcas.

import { NextResponse, type NextRequest } from "next/server";
import { almacen, escribirJson, leerJson } from "@/lib/almacen";
import { COOKIE_SESION, leerConfig, verificarSesion } from "@/lib/auth";
import { capturarCuadro, elegirMomento, type PedirRango } from "@/lib/cuadro";
import { buscar, type Episodio } from "@/lib/episodes";
import { conArte, KEY_MARCAS, keyArte, MAX_ARTE_BYTES, normalizarMarcas } from "@/lib/marcas";
import { analizar, type Lector } from "@/lib/mp4";
import { leerR2, pedirR2 } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Si no hay portada, la genera: lee la cabecera del mp4 para saber la
 * duración, elige un momento pasado el arranque (o después de la intro) y
 * le pide a ffmpeg ese cuadro. Se hace una sola vez por capítulo.
 */
async function generarPortada(req: NextRequest, ep: Episodio): Promise<Uint8Array> {
  const a = almacen();
  const r2 = leerR2();
  const marcas = normalizarMarcas(await leerJson(a, KEY_MARCAS));

  let pedir: PedirRango;
  let lector: Lector;
  let tamano = 0;
  if (r2) {
    const cabeza = await pedirR2(r2, ep.key, { method: "HEAD" });
    if (!cabeza.ok) throw new Error(`El archivo ${ep.key} no está en el bucket (${cabeza.status}).`);
    tamano = Number(cabeza.headers.get("content-length") ?? 0);
    pedir = (rango, signal) => pedirR2(r2, ep.key, { headers: rango ? { Range: rango } : {}, signal });
    lector = async (inicio, fin) => {
      const res = await pedirR2(r2, ep.key, { headers: { Range: `bytes=${inicio}-${fin - 1}` } });
      if (!res.ok) throw new Error(`R2 respondió ${res.status}.`);
      return new Uint8Array(await res.arrayBuffer());
    };
  } else {
    const url = new URL("/demo/muestra.mp4", req.nextUrl.origin).toString();
    const cabeza = await fetch(url, { method: "HEAD", cache: "no-store" });
    tamano = Number(cabeza.headers.get("content-length") ?? 0);
    pedir = (rango, signal) => fetch(url, { headers: rango ? { Range: rango } : {}, signal, cache: "no-store" });
    lector = async (inicio, fin) => {
      const res = await fetch(url, { headers: { Range: `bytes=${inicio}-${fin - 1}` }, cache: "no-store" });
      const buf = new Uint8Array(await res.arrayBuffer());
      return res.status === 200 && buf.length > fin - inicio ? buf.subarray(inicio, fin) : buf;
    };
  }

  let duracion: number | null = null;
  try {
    if (tamano) duracion = (await analizar(lector, tamano)).duracion;
  } catch {
    // sin duración se elige un momento fijo
  }
  const momento = elegirMomento(duracion, marcas[ep.id]?.intro);
  const jpeg = await capturarCuadro(pedir, momento);
  // Sólo se guarda la imagen: 24 generaciones a la vez pisarían marcas.json
  // entre sí. Quién tiene portada se sabe listando art/, no por las marcas.
  await a.escribirBytes(keyArte(ep.id), jpeg, "image/jpeg");
  return jpeg;
}

async function conSesion(req: NextRequest): Promise<boolean> {
  const config = leerConfig();
  return !!(config.ok && (await verificarSesion(req.cookies.get(COOKIE_SESION)?.value, config.config)));
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await conSesion(req))) return new NextResponse("Sin sesión.", { status: 401 });
  const { id } = await params;
  if (!buscar(id)) return new NextResponse("Ese capítulo no existe.", { status: 404 });
  const ep = buscar(id)!;
  try {
    let datos = await almacen().leerBytes(keyArte(id));
    if (!datos) {
      try {
        datos = await generarPortada(req, ep);
      } catch (e) {
        console.error(`portada ${id}:`, e instanceof Error ? e.message : e);
        return new NextResponse(e instanceof Error ? e.message : "No pude generar la portada.", {
          status: 404,
          headers: { "Cache-Control": "private, no-store" },
        });
      }
    }
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
