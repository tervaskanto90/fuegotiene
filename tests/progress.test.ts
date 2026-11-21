import { test } from "node:test";
import assert from "node:assert/strict";
import { aMedias, conPrevio, proximoSinVer, ultimoEmpezado, type MapaProgreso } from "../lib/progress.ts";

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

test("proximoSinVer: el primero en orden que falta, con dónde seguir si quedó a medias", () => {
  const ids = ["s01e02", "s01e05", "s01e09", "s02e03"];
  const mapa: MapaProgreso = {
    "s01e02": { t: 2700, d: 2700, en: 100, visto: true },
    "s01e05": { t: 2600, d: 2700, en: 200, visto: false }, // pasó el 92 %: cuenta como visto
    "s01e09": { t: 761, d: 2700, en: 300, visto: false },
  };
  assert.deepEqual(proximoSinVer(ids, mapa), { id: "s01e09", desde: 761 });
  mapa["s01e09"] = { t: 2700, d: 2700, en: 400, visto: true };
  assert.deepEqual(proximoSinVer(ids, mapa), { id: "s02e03", desde: null });
  mapa["s02e03"] = { t: 5, d: 2700, en: 500, visto: false }; // menos de 15 s: se empieza de cero
  assert.deepEqual(proximoSinVer(ids, mapa), { id: "s02e03", desde: null });
  mapa["s02e03"] = { t: 2700, d: 2700, en: 600, visto: true };
  assert.equal(proximoSinVer(ids, mapa), null, "los vio todos");
  assert.deepEqual(proximoSinVer(ids, {}), { id: "s01e02", desde: null });
});

test("vistoElTexto: hoy, ayer, el día del mes, y el año sólo si es otro", async () => {
  const { vistoElTexto } = await import("../lib/episodes.ts");
  const ahora = new Date(2026, 10, 21, 0, 30).getTime(); // 21 nov, recién pasada la medianoche
  assert.equal(vistoElTexto(new Date(2026, 10, 21, 0, 5).getTime(), ahora), "visto hoy");
  assert.equal(vistoElTexto(new Date(2026, 10, 20, 23, 50).getTime(), ahora), "visto ayer", "cuenta días, no horas");
  assert.equal(vistoElTexto(new Date(2026, 10, 18, 22, 0).getTime(), ahora), "visto el 18 nov");
  assert.equal(vistoElTexto(new Date(2026, 0, 2, 12, 0).getTime(), ahora), "visto el 2 ene");
  assert.equal(vistoElTexto(new Date(2025, 11, 31, 12, 0).getTime(), ahora), "visto el 31 dic 2025");
  assert.equal(vistoElTexto(0, ahora), "", "sin fecha no inventa una");
  assert.equal(vistoElTexto(Number.NaN, ahora), "");
  assert.equal(vistoElTexto(ahora + 86_400_000 * 3, ahora), "", "un reloj adelantado no dice nada");
});
