import { test } from "node:test";
import assert from "node:assert/strict";
import { aMedias, ultimoEmpezado, type MapaProgreso } from "../lib/progress.ts";

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
