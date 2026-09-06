// Estado general: si el bucket responde y qué archivos tiene. Sirve para
// distinguir credenciales mal cargadas, nombre de bucket equivocado y
// archivos subidos con nombres que no coinciden con ningún capítulo.

import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, leerConfig, verificarSesion } from "@/lib/auth";
import { episodios } from "@/lib/episodes";
import { esInterno } from "@/lib/marcas";
import { leerR2, probarBucket, type ObjetoR2 } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export type EstadoBucket = {
  modo: "r2" | "demo";
  bucket: string | null;
  acceso: "ok" | "credenciales" | "bucket" | "error" | "demo";
  mensaje: string;
  total: number | null;
  truncado: boolean;
  /** archivos del bucket que ningún capítulo usa como key ni sub */
  sueltos: ObjetoR2[];
};

export async function GET(req: NextRequest) {
  const config = leerConfig();
  const sesion = config.ok ? await verificarSesion(req.cookies.get(COOKIE_SESION)?.value, config.config) : null;
  if (!sesion) return NextResponse.json({ error: "Sin sesión." }, { status: 401 });

  const sinCache = { "Cache-Control": "private, no-store" };
  const r2 = leerR2();
  if (!r2) {
    const demo: EstadoBucket = {
      modo: "demo",
      bucket: null,
      acceso: "demo",
      mensaje: "Sin R2 configurado. Todos los capítulos apuntan al clip de muestra.",
      total: null,
      truncado: false,
      sueltos: [],
    };
    return NextResponse.json(demo, { headers: sinCache });
  }

  const prueba = await probarBucket(r2);
  if (prueba.acceso !== "ok") {
    const malo: EstadoBucket = {
      modo: "r2",
      bucket: r2.bucket,
      acceso: prueba.acceso,
      mensaje: prueba.mensaje,
      total: null,
      truncado: false,
      sueltos: [],
    };
    return NextResponse.json(malo, { headers: sinCache });
  }

  const usados = new Set(episodios.flatMap((e) => [e.key, e.sub, e.arte ? `art/${e.arte}` : ""]).filter(Boolean));
  const sueltos = prueba.listado.objetos.filter((o) => !usados.has(o.key) && !esInterno(o.key));
  const bien: EstadoBucket = {
    modo: "r2",
    bucket: r2.bucket,
    acceso: "ok",
    mensaje: `El bucket responde y tiene ${prueba.listado.objetos.length} ${prueba.listado.objetos.length === 1 ? "archivo" : "archivos"}${prueba.listado.truncado ? " (o más)" : ""}.`,
    total: prueba.listado.objetos.length,
    truncado: prueba.listado.truncado,
    sueltos,
  };
  return NextResponse.json(bien, { headers: sinCache });
}
