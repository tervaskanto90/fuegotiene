// Lo anotado por capítulo que no cabe en el navegador de una sola persona:
// si ese capítulo ya tiene un cuadro de portada. Vive en un JSON chico en el
// bucket (marcas.json), al lado de los videos. No es una base de datos: es un
// archivo que el sitio lee y reescribe entero.
//
// Hubo también una marca de intro, con su botón para saltearla y la pantalla
// para ponerla. Esa pantalla se sacó del reproductor, así que la marca se fue
// con ella: un campo que nadie puede escribir no es un dato, es un resto.

export type Marca = {
  /** momento en que se guardó la portada (ms), sirve para refrescar la imagen */
  arte?: number;
};

export type Marcas = Record<string, Marca>;

export const KEY_MARCAS = "marcas.json";
export const PREFIJO_ARTE = "art/";
export const MAX_ARTE_BYTES = 400 * 1024;

export function keyArte(id: string): string {
  return `${PREFIJO_ARTE}${id}.jpg`;
}

/** ¿Es un objeto del bucket que usa el sitio para anotaciones, no un capítulo? */
export function esInterno(key: string): boolean {
  return key === KEY_MARCAS || key.startsWith(PREFIJO_ARTE);
}

/** Deja sólo lo que tiene la forma esperada; lo demás se descarta en silencio. */
export function normalizarMarcas(crudo: unknown): Marcas {
  const salida: Marcas = {};
  if (!crudo || typeof crudo !== "object") return salida;
  for (const [id, valor] of Object.entries(crudo as Record<string, unknown>)) {
    if (!/^s\d{2}e\d{2}$/.test(id) || !valor || typeof valor !== "object") continue;
    const m = valor as Record<string, unknown>;
    const marca: Marca = {};
    if (typeof m.arte === "number" && Number.isFinite(m.arte) && m.arte > 0) marca.arte = Math.floor(m.arte);
    if (marca.arte) salida[id] = marca;
  }
  return salida;
}

export function conArte(marcas: Marcas, id: string, version: number): Marcas {
  return { ...marcas, [id]: { ...(marcas[id] ?? {}), arte: version } };
}
