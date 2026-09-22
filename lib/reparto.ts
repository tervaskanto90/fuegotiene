// Quién actuó en cada capítulo.
//
// Los datos salen de la lista de episodios de Wikipedia en español (CC BY-SA),
// que el dueño del sitio exportó y pasó en un documento. **Son nombres, no
// texto**: acá no hay sinopsis copiadas, y si algún día se quieren, se
// escriben (misma regla que `data/episodes.json`).
//
// `invitados` son los que tienen un papel identificable en el capítulo, con
// el personaje cuando se lo pudo atar; `tambien` es el resto del reparto, que
// en esta serie es larguísimo: hay capítulos con más de veinte nombres.

import datos from "@/data/reparto.json";
import { episodios } from "@/lib/episodes";

export type Invitado = { actor: string; personaje: string };
export type RepartoCapitulo = { invitados: Invitado[]; tambien: string[] };

const reparto = datos as Record<string, RepartoCapitulo>;

export function repartoDe(id: string): RepartoCapitulo {
  return reparto[id] ?? { invitados: [], tambien: [] };
}

/** Cuántos nombres hay en total, para poder decirlo sin contarlos a mano. */
export function totalDeNombres(): number {
  return Object.values(reparto).reduce((n, r) => n + r.invitados.length + r.tambien.length, 0);
}

export type Recurrente = {
  actor: string;
  /** el personaje que se le conoce, si en algún capítulo quedó nombrado */
  personaje: string;
  /** en cuántos de los 24 aparece */
  capitulos: number;
};

/**
 * Las caras que vuelven. Es lo mejor que tiene este listado: Los Simuladores
 * no repartía invitados sueltos, armaba una comunidad. El cliente de un
 * capítulo reaparece dos capítulos después recomendándole el grupo a otro, y
 * algunos terminan trabajando con ellos en la Brigada B.
 */
export function recurrentes(minimo = 3): Recurrente[] {
  const cuenta = new Map<string, number>();
  const personaje = new Map<string, string>();
  for (const id of episodios.map((e) => e.id)) {
    const r = repartoDe(id);
    for (const i of r.invitados) {
      cuenta.set(i.actor, (cuenta.get(i.actor) ?? 0) + 1);
      // El primer personaje con nombre propio que se le conoce queda pegado.
      if (i.personaje && /^[A-ZÁÉÍÓÚÑ]/.test(i.personaje) && !personaje.has(i.actor)) {
        personaje.set(i.actor, i.personaje);
      }
    }
    for (const a of r.tambien) cuenta.set(a, (cuenta.get(a) ?? 0) + 1);
  }
  return [...cuenta.entries()]
    .filter(([, n]) => n >= minimo)
    .map(([actor, capitulos]) => ({ actor, personaje: personaje.get(actor) ?? "", capitulos }))
    .sort((a, b) => b.capitulos - a.capitulos || a.actor.localeCompare(b.actor, "es"));
}
