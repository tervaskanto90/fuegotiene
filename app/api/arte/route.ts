// Qué capítulos ya tienen portada guardada, listando art/ en el bucket.

import { NextResponse, type NextRequest } from "next/server";
import { almacen } from "@/lib/almacen";
import { quienPide } from "@/lib/pases";
import { PREFIJO_ARTE } from "@/lib/marcas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await quienPide(req)).entra) return NextResponse.json({ error: "Todavía no pasaste el juego." }, { status: 403 });
  try {
    const keys = await almacen().listar(PREFIJO_ARTE);
    const ids = keys
      .map((k) => /^art\/(s\d{2}e\d{2})\.jpg$/.exec(k)?.[1])
      .filter((id): id is string => !!id);
    return NextResponse.json({ ids }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No pude listar las portadas." }, { status: 502 });
  }
}
