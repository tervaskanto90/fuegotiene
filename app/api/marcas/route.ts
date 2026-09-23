// Lo anotado por capítulo, hoy sólo qué capítulos tienen portada. Esta ruta
// nada más lee: la única escritura de marcas.json es la de /api/arte, cuando
// guarda una portada. El POST que anotaba la intro se fue con la pantalla que
// lo llamaba.

import { NextResponse, type NextRequest } from "next/server";
import { almacen, leerJson } from "@/lib/almacen";
import { quienPide } from "@/lib/pases";
import { KEY_MARCAS, normalizarMarcas } from "@/lib/marcas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIN_CACHE = { "Cache-Control": "private, no-store" };

export async function GET(req: NextRequest) {
  if (!(await quienPide(req)).entra) return NextResponse.json({ error: "Todavía no pasaste el juego." }, { status: 403 });
  try {
    const marcas = normalizarMarcas(await leerJson(almacen(), KEY_MARCAS));
    return NextResponse.json(marcas, { headers: SIN_CACHE });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No pude leer las anotaciones." }, { status: 502, headers: SIN_CACHE });
  }
}
