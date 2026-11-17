import { test } from "node:test";
import assert from "node:assert/strict";
import { aMedias, conPrevio, ultimoEmpezado, type MapaProgreso } from "../lib/progress.ts";

test("aMedias: sólo los que se pueden seguir, del más reciente al más viejo", () => {
  const mapa: MapaProgreso = {
    "1x01": { t: 600, d: 2700, en: 100, visto: false },
    "1x02": { t: 2700, d: 2700, en: 300, visto: true },
    "1x03": { t: 5, d: 2700, en: 400, visto: false }, // menos de 15 s: no cuenta
    "1x04": { t: 1200, d: 2700, en: 200, visto: false },
    "2x01": { t: 2600, d: 2700, en: 500, visto: false }, // pasó el 92 %: ya es visto
    "2x02": { t: 900, d: 0, en: 50, visto: false }, // sin duración conocida igual sirve
  };
  assert.deepEqual(
    aMedias(mapa).map((x) => x.id),
    ["1x04", "1x01", "2x02"],
  );
  assert.equal(ultimoEmpezado(mapa)?.id, aMedias(mapa)[0].id, "el primero es el del destacado");
  assert.deepEqual(aMedias({}), []);
});

test("conPrevio: deshacer \"marcar como visto\" devuelve la posición exacta", () => {
  const previo = { t: 1200, d: 2700, en: 200, visto: false };
  const marcado: MapaProgreso = {
    "s01e04": { t: 2700, d: 2700, en: 900, visto: true },
    "s01e05": { t: 30, d: 2700, en: 100, visto: false },
  };
  const vuelto = conPrevio(marcado, "s01e04", previo);
  assert.deepEqual(vuelto["s01e04"], previo);
  assert.equal(ultimoEmpezado(vuelto)?.id, "s01e04", "vuelve a ser el destacado");
  assert.deepEqual(vuelto["s01e05"], marcado["s01e05"], "no toca los demás");
  assert.equal(marcado["s01e04"].visto, true, "no muta el mapa que recibe");
  // Si no había nada antes (el "para empezar"), deshacer lo saca del mapa.
  assert.equal("s01e04" in conPrevio(marcado, "s01e04", undefined), false);
});
