// Los pases anotados en el bucket. Es la parte de `lib/puerta.ts` que necesita
// Node: el middleware corre en Edge y no puede entrar acá.
//
// `pases.json` es un archivo chico al lado de `marcas.json`, con la misma
// idea: se lee y se reescribe entero. Guarda, por id de código, el mejor
// puntaje con el que esa persona cruzó la puerta. Sirve para que no tenga que
// volver a jugar si entra desde otro navegador o desde el celular.

import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { almacen, escribirJson, leerJson } from "@/lib/almacen";
import { COOKIE_PASE, COOKIE_SESION, crearPase, leerConfig, verificarPase, verificarSesion } from "@/lib/auth";
import {
  conPase,
  KEY_PASES,
  normalizarPases,
  puntajeParaEntrar,
  type EstadoPuerta,
  type Pase,
  type Pases,
} from "@/lib/puerta";

export async function leerPases(): Promise<Pases> {
  try {
    return normalizarPases(await leerJson(almacen(), KEY_PASES));
  } catch {
    // Si el bucket no contesta, nadie se queda sin entrar por eso: el que
    // tiene la cookie sigue entrando y el que no, juega.
    return {};
  }
}

export async function paseGuardado(id: string): Promise<Pase | null> {
  return (await leerPases())[id] ?? null;
}

/** Anota el pase si es el primero o si mejora el anterior. Nunca tira el error. */
export async function guardarPase(id: string, pase: Pase): Promise<void> {
  try {
    const pases = await leerPases();
    const nuevos = conPase(pases, id, pase);
    if (nuevos === pases) return;
    await escribirJson(almacen(), KEY_PASES, nuevos);
  } catch (e) {
    console.error("no pude anotar el pase:", e instanceof Error ? e.message : e);
  }
}

/**
 * El estado de la puerta para una página o la cabecera. Sólo mira las
 * cookies, que es lo que vale: el pase anotado en el bucket se convierte en
 * cookie al entrar con un código.
 */
export async function estadoPuerta(): Promise<EstadoPuerta> {
  const tarro = await cookies();
  const minimo = puntajeParaEntrar();
  const config = leerConfig();
  if (!config.ok) return { paso: false, puntaje: null, minimo, dueno: false, sesion: false };
  // Puede no haber sesión: al sitio se entra sin nada y el pase vale solo.
  const sesion = await verificarSesion(tarro.get(COOKIE_SESION)?.value, config.config);
  if (sesion?.libre) {
    return { paso: true, puntaje: null, minimo, dueno: sesion.dueno, sesion: true };
  }
  const pase = await verificarPase(tarro.get(COOKIE_PASE)?.value, config.config);
  return {
    paso: pase !== null,
    puntaje: pase?.puntaje ?? null,
    minimo,
    dueno: false,
    sesion: sesion !== null,
  };
}

/**
 * Quién está del otro lado de un pedido a una API. Es lo mismo que decide el
 * middleware, repetido acá para las rutas que no quieren depender de que el
 * middleware haya corrido.
 *
 * `entra`: ganó el juego, o tiene un código de los que se lo saltean.
 * `dueno`: además puede tocar el bucket.
 */
export async function quienPide(req: NextRequest): Promise<{ entra: boolean; dueno: boolean }> {
  const config = leerConfig();
  if (!config.ok) return { entra: false, dueno: false };
  const sesion = await verificarSesion(req.cookies.get(COOKIE_SESION)?.value, config.config);
  if (sesion?.libre) return { entra: true, dueno: sesion.dueno };
  const pase = await verificarPase(req.cookies.get(COOKIE_PASE)?.value, config.config);
  return { entra: pase !== null, dueno: false };
}
