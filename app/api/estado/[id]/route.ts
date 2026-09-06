// Revisa un capítulo en R2: si el archivo está, cuánto pesa y si el
// navegador lo va a poder reproducir (lib/mp4.ts). Lee sólo cabeceras y el
// índice del archivo con pedidos parciales; nunca el video entero.

import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, leerConfig, verificarSesion } from "@/lib/auth";
import { buscar } from "@/lib/episodes";
import { analizar, type Analisis, type Lector } from "@/lib/mp4";
import { leerR2, pedirR2, type ConfigR2 } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export type EstadoCapitulo = {
  id: string;
  key: string;
  modo: "r2" | "demo";
  existe: boolean;
  tamano: number | null;
  tipo: string | null;
  analisis: Analisis | null;
  sub: { key: string; existe: boolean } | null;
  error: string | null;
};

const MAX_BYTES = 64 * 1024 * 1024;
const MENSAJE_RED =
  "No pude conectarme a R2 para revisar el archivo. Revisá R2_ACCOUNT_ID (la tira de 32 caracteres) y probá de nuevo en un rato.";

/** Errores con un mensaje pensado para mostrarse tal cual. Todo lo demás es un problema de red. */
class ErrorLegible extends Error {}

function lectorR2(r2: ConfigR2, key: string): Lector {
  let leidos = 0;
  return async (inicio, fin) => {
    if (fin <= inicio) return new Uint8Array(0);
    leidos += fin - inicio;
    if (leidos > MAX_BYTES) throw new ErrorLegible("El índice del archivo es demasiado grande para revisarlo desde acá.");
    const res = await pedirR2(r2, key, { headers: { Range: `bytes=${inicio}-${fin - 1}` } });
    if (res.status !== 206 && res.status !== 200) {
      throw new ErrorLegible(`R2 respondió ${res.status} al pedir un pedazo del archivo.`);
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    // Si R2 ignoró el Range y mandó todo, recortamos.
    return res.status === 200 && buf.length > fin - inicio ? buf.subarray(inicio, fin) : buf;
  };
}

/**
 * Modo demo: se analiza el clip de muestra por HTTP, con los mismos pedidos
 * parciales que se usan contra R2. Leerlo del disco con process.cwd() no es
 * confiable en Vercel (la función puede no traer public/ empaquetado), así
 * que el disco queda sólo como respaldo para correr en local.
 */
async function estadoDemo(req: NextRequest, id: string, key: string): Promise<EstadoCapitulo> {
  const url = new URL("/demo/muestra.mp4", req.nextUrl.origin).toString();
  try {
    const cabeza = await fetch(url, { method: "HEAD", cache: "no-store" });
    const tamano = Number(cabeza.headers.get("content-length") ?? 0);
    if (!cabeza.ok || !tamano) throw new Error(`HEAD ${cabeza.status}`);
    const leer: Lector = async (inicio, fin) => {
      const res = await fetch(url, { headers: { Range: `bytes=${inicio}-${fin - 1}` }, cache: "no-store" });
      if (!res.ok) throw new Error(`Range ${res.status}`);
      const buf = new Uint8Array(await res.arrayBuffer());
      return res.status === 200 && buf.length > fin - inicio ? buf.subarray(inicio, fin) : buf;
    };
    const analisis = await analizar(leer, tamano);
    return { id, key, modo: "demo", existe: true, tamano, tipo: "video/mp4", analisis, sub: null, error: null };
  } catch {
    const ruta = path.join(process.cwd(), "public", "demo", "muestra.mp4");
    const info = await stat(ruta);
    const datos = new Uint8Array(await readFile(ruta));
    const analisis = await analizar(async (a, b) => datos.subarray(a, b), info.size);
    return { id, key, modo: "demo", existe: true, tamano: info.size, tipo: "video/mp4", analisis, sub: null, error: null };
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const config = leerConfig();
  const sesion = config.ok ? await verificarSesion(req.cookies.get(COOKIE_SESION)?.value, config.config) : null;
  if (!sesion) return NextResponse.json({ error: "Sin sesión." }, { status: 401 });

  const { id } = await params;
  const ep = buscar(id);
  if (!ep) return NextResponse.json({ error: "Ese capítulo no existe." }, { status: 404 });

  const r2 = leerR2();
  const sinCache = { "Cache-Control": "private, no-store" };
  if (!r2) {
    return NextResponse.json(await estadoDemo(req, ep.id, ep.key), { headers: sinCache });
  }

  const resultado: EstadoCapitulo = {
    id: ep.id,
    key: ep.key,
    modo: "r2",
    existe: false,
    tamano: null,
    tipo: null,
    analisis: null,
    sub: null,
    error: null,
  };

  try {
    const cabeza = await pedirR2(r2, ep.key, { method: "HEAD" });
    if (cabeza.status === 404) {
      return NextResponse.json(resultado, { headers: sinCache });
    }
    if (cabeza.status === 403) {
      resultado.error =
        "R2 rechazó las credenciales (403). Revisá R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY y que el token tenga permiso sobre el bucket.";
      return NextResponse.json(resultado, { headers: sinCache });
    }
    if (!cabeza.ok) {
      resultado.error = `R2 respondió ${cabeza.status} al consultar el archivo.`;
      return NextResponse.json(resultado, { headers: sinCache });
    }
    resultado.existe = true;
    resultado.tamano = Number(cabeza.headers.get("content-length") ?? 0) || null;
    resultado.tipo = cabeza.headers.get("content-type");

    if (resultado.tamano) {
      resultado.analisis = await analizar(lectorR2(r2, ep.key), resultado.tamano);
    }

    if (ep.sub) {
      const s = await pedirR2(r2, ep.sub, { method: "HEAD" });
      resultado.sub = { key: ep.sub, existe: s.ok };
    }
  } catch (e) {
    resultado.error = e instanceof ErrorLegible ? e.message : MENSAJE_RED;
  }

  return NextResponse.json(resultado, { headers: sinCache });
}
