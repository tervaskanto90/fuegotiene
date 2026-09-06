// Anotaciones por capítulo que no caben en el navegador de una sola persona:
// dónde está la intro y si hay un cuadro de portada. Viven en un JSON chico
// en el bucket (marcas.json), al lado de los videos. No es una base de
// datos: es un archivo que el sitio lee y reescribe entero.

export type Marca = {
  /** [empieza, termina] en segundos */
  intro?: [number, number];
  /** momento en que se guardó la portada (ms), sirve para refrescar la imagen */
  arte?: number;
};

export type Marcas = Record<string, Marca>;

export const KEY_MARCAS = "marcas.json";
export const PREFIJO_ARTE = "art/";
export const MAX_INTRO_S = 600;
export const MAX_ARTE_BYTES = 400 * 1024;

export function keyArte(id: string): string {
  return `${PREFIJO_ARTE}${id}.jpg`;
}

/** ¿Es un objeto del bucket que usa el sitio para anotaciones, no un capítulo? */
export function esInterno(key: string): boolean {
  return key === KEY_MARCAS || key.startsWith(PREFIJO_ARTE);
}

export function validarIntro(valor: unknown): [number, number] | null {
  if (!Array.isArray(valor) || valor.length !== 2) return null;
  const [a, b] = valor.map((n) => (typeof n === "number" && Number.isFinite(n) ? Math.round(n * 10) / 10 : NaN));
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  if (a < 0 || b <= a || b - a > MAX_INTRO_S) return null;
  return [a, b];
}

/** Deja sólo lo que tiene la forma esperada; lo demás se descarta en silencio. */
export function normalizarMarcas(crudo: unknown): Marcas {
  const salida: Marcas = {};
  if (!crudo || typeof crudo !== "object") return salida;
  for (const [id, valor] of Object.entries(crudo as Record<string, unknown>)) {
    if (!/^s\d{2}e\d{2}$/.test(id) || !valor || typeof valor !== "object") continue;
    const m = valor as Record<string, unknown>;
    const marca: Marca = {};
    const intro = validarIntro(m.intro);
    if (intro) marca.intro = intro;
    if (typeof m.arte === "number" && Number.isFinite(m.arte) && m.arte > 0) marca.arte = Math.floor(m.arte);
    if (marca.intro || marca.arte) salida[id] = marca;
  }
  return salida;
}

export function conIntro(marcas: Marcas, id: string, intro: [number, number] | null): Marcas {
  const actual = { ...(marcas[id] ?? {}) };
  if (intro) actual.intro = intro;
  else delete actual.intro;
  const salida = { ...marcas };
  if (actual.intro || actual.arte) salida[id] = actual;
  else delete salida[id];
  return salida;
}

export function conArte(marcas: Marcas, id: string, version: number): Marcas {
  return { ...marcas, [id]: { ...(marcas[id] ?? {}), arte: version } };
}

/** ¿El tiempo actual cae dentro de la intro, con medio segundo de margen al final? */
export function enIntro(intro: [number, number] | undefined, t: number): boolean {
  return !!intro && t >= intro[0] && t < intro[1] - 0.5;
}
