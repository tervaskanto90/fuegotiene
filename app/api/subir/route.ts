// Firma una URL de subida (PUT) para que el navegador mande el archivo
// directo a R2. Los bytes no pasan por Vercel: mismo principio que el video.
// El bucket necesita una política CORS que permita PUT desde el sitio; la
// página /subir la muestra lista para pegar.

import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, leerConfig, verificarSesion } from "@/lib/auth";
import { firmarUrl, leerR2, MAX_SUBIDA_BYTES, nombreDeObjetoValido } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Una subida grande por una conexión lenta puede llevar horas. */
const EXPIRA_SUBIDA_S = 12 * 60 * 60;

export async function POST(req: NextRequest) {
  const config = leerConfig();
  const sesion = config.ok ? await verificarSesion(req.cookies.get(COOKIE_SESION)?.value, config.config) : null;
  if (!sesion) return NextResponse.json({ error: "Sin sesión. Entrá con tu código." }, { status: 401 });

  const r2 = leerR2();
  if (!r2) {
    return NextResponse.json({ error: "Sin R2 configurado no hay dónde subir. Cargá las variables de R2 en Vercel." }, { status: 400 });
  }

  let cuerpo: { nombre?: unknown; tamano?: unknown };
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido mal armado." }, { status: 400 });
  }
  const nombre = typeof cuerpo.nombre === "string" ? cuerpo.nombre : "";
  const tamano = typeof cuerpo.tamano === "number" ? cuerpo.tamano : 0;
  if (!nombreDeObjetoValido(nombre)) {
    return NextResponse.json(
      { error: "Ese nombre no sirve: sin barras ni signos raros, y con extensión de video, .vtt o imagen." },
      { status: 400 },
    );
  }
  if (tamano <= 0 || tamano > MAX_SUBIDA_BYTES) {
    return NextResponse.json({ error: "El archivo tiene que pesar entre 1 byte y 5 GB." }, { status: 400 });
  }

  const url = await firmarUrl(r2, nombre, { metodo: "PUT", expiraS: EXPIRA_SUBIDA_S });
  return NextResponse.json({ url, nombre }, { headers: { "Cache-Control": "private, no-store" } });
}
