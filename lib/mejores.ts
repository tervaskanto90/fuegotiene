// El mejor puntaje de cada caso del juego, en el localStorage de cada
// navegador, como el progreso de los capítulos. Es un recordatorio para quien
// vuelve a jugar, nada más: el pase lo sigue decidiendo el servidor.

export type Mejores = Record<string, number>;

export const CLAVE_MEJORES = "ft.mejores";

/** Deja sólo pares caso → puntaje entero entre 0 y 100. Lo demás se descarta. */
export function normalizarMejores(datos: unknown): Mejores {
  const limpio: Mejores = {};
  if (!datos || typeof datos !== "object" || Array.isArray(datos)) return limpio;
  for (const [id, v] of Object.entries(datos as Record<string, unknown>)) {
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    limpio[id] = Math.max(0, Math.min(100, Math.round(v)));
  }
  return limpio;
}

/** Anota un puntaje si supera al que había. Devuelve el mapa nuevo (o el mismo, si no cambió). */
export function anotarMejor(mapa: Mejores, casoId: string, puntaje: number): Mejores {
  if (!Number.isFinite(puntaje)) return mapa;
  const p = Math.max(0, Math.min(100, Math.round(puntaje)));
  if (mapa[casoId] !== undefined && mapa[casoId] >= p) return mapa;
  return { ...mapa, [casoId]: p };
}

export function leerMejores(): Mejores {
  if (typeof window === "undefined") return {};
  try {
    const crudo = window.localStorage.getItem(CLAVE_MEJORES);
    return crudo ? normalizarMejores(JSON.parse(crudo)) : {};
  } catch {
    return {};
  }
}

export function guardarMejores(mapa: Mejores) {
  try {
    window.localStorage.setItem(CLAVE_MEJORES, JSON.stringify(mapa));
  } catch {
    // sin espacio o modo privado: se sigue sin guardar
  }
}

/**
 * El caso al que lleva "otro caso": el siguiente en orden (dando la vuelta)
 * que este navegador todavía no pasó con el mínimo. Si ya los pasó todos, o
 * si sólo falta el que está abierto, el siguiente en orden y listo.
 */
export function siguienteCaso(ids: string[], actual: string, mapa: Mejores, minimo: number): string {
  const n = ids.length;
  const i = ids.indexOf(actual);
  for (let k = 1; k < n; k++) {
    const id = ids[(i + k + n) % n];
    if ((mapa[id] ?? -1) < minimo) return id;
  }
  return ids[(i + 1 + n) % n];
}

/** Cuántos de los casos jugó este navegador y cuántos pasó con el mínimo. */
export function cuentaCasos(ids: string[], mapa: Mejores, minimo: number) {
  let jugados = 0;
  let pasados = 0;
  for (const id of ids) {
    if (mapa[id] === undefined) continue;
    jugados++;
    if (mapa[id] >= minimo) pasados++;
  }
  return { jugados, pasados, total: ids.length };
}

const NUMEROS = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez"];

/**
 * La línea que va debajo de los casos. Vacía si este navegador no jugó
 * ninguno: ahí no hay nada que contar y el cartel de la puerta ya dice el trato.
 */
export function textoCuenta(c: { jugados: number; pasados: number; total: number }, minimo: number): string {
  if (c.jugados === 0) return "";
  const total = NUMEROS[c.total] ?? String(c.total);
  if (c.pasados === c.total) return `Pasaste los ${total} casos.`;
  if (c.pasados === 0) {
    return c.jugados === 1
      ? `Jugaste uno de los ${total} casos; todavía no llegó a ${minimo}.`
      : `Jugaste ${c.jugados} de los ${total} casos; todavía ninguno llegó a ${minimo}.`;
  }
  const faltan = c.total - c.pasados;
  return `Pasaste ${c.pasados} de los ${total} casos con ${minimo} o más; ${
    faltan === 1 ? "queda uno" : `quedan ${faltan}`
  }.`;
}
