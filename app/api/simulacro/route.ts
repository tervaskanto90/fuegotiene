// Evalúa el plan del juego y devuelve el relato del operativo.
//
// **Esta ruta no sale a internet y no puede costar plata.** El desenlace lo
// escribe entero `lib/simulacro.ts`, que es código local y determinista. Hubo
// una versión que le pedía la narración a Claude si había una clave cargada:
// se sacó a propósito cuando el sitio pasó a ser público, porque acá entra
// cualquiera con el link y cada partida se le facturaba al dueño. Si algún
// día vuelve, tiene que venir con algo que la haga imposible de gastar sin
// querer: un límite duro del lado de Anthropic, o sólo para el dueño.
//
// Lo mismo vale para cualquier otra API paga: este sitio se banca con el plan
// gratis de Vercel y el de R2, y esa es una decisión, no una casualidad.

import { NextResponse, type NextRequest } from "next/server";
import {
  COOKIE_PASE,
  COOKIE_SESION,
  crearPase,
  idAnonimo,
  leerConfig,
  opcionesCookie,
  verificarPase,
  verificarSesion,
} from "@/lib/auth";
import { guardarPase } from "@/lib/pases";
import { puntajeParaEntrar } from "@/lib/puerta";
import { buscarCaso, evaluarPlan, MAX_PLAN } from "@/lib/simulacro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Sin sesión: al juego se llega sin nada, es la puerta del sitio.
  const config = leerConfig();
  if (!config.ok) {
    return NextResponse.json(
      { error: `El sitio está sin terminar de configurar. ${config.problema}` },
      { status: 503 },
    );
  }
  const sesion = await verificarSesion(req.cookies.get(COOKIE_SESION)?.value, config.config);

  let cuerpo: { casoId?: unknown; plan?: unknown };
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido mal armado." }, { status: 400 });
  }
  const caso = buscarCaso(typeof cuerpo.casoId === "string" ? cuerpo.casoId : "");
  if (!caso) return NextResponse.json({ error: "Ese caso no existe." }, { status: 404 });
  const plan = (typeof cuerpo.plan === "string" ? cuerpo.plan : "").slice(0, MAX_PLAN);

  const resultado = evaluarPlan(caso, plan);
  const sinCache = { "Cache-Control": "private, no-store" };

  const minimo = puntajeParaEntrar();
  const paseActual = await verificarPase(req.cookies.get(COOKIE_PASE)?.value, config.config);
  const tenia = !!sesion?.libre || paseActual !== null;
  const abre = resultado.puntaje >= minimo;
  const puerta = { minimo, puntaje: resultado.puntaje, paso: abre || tenia, recien: abre && !tenia };

  const res = NextResponse.json({ ...resultado, puerta }, { headers: sinCache });
  if (abre && !sesion?.libre) {
    // El id es el del código si entró con uno, el del pase que ya tenía, o
    // uno anónimo nuevo: la mayoría de la gente llega sin nada.
    const id = sesion?.id ?? paseActual?.id ?? idAnonimo();
    res.cookies.set(
      COOKIE_PASE,
      await crearPase(id, resultado.puntaje, config.config),
      opcionesCookie(process.env.NODE_ENV === "production"),
    );
    await guardarPase(id, { puntaje: resultado.puntaje, caso: caso.id, fecha: Date.now() });
  }
  return res;
}
