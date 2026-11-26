import { test } from "node:test";
import assert from "node:assert/strict";
import { aMedias, conPrevio, proximoDespues, proximoSinVer, sinVer, ultimoEmpezado, unoCualquiera, type MapaProgreso } from "../lib/progress.ts";

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

test("sinVer: los que faltan, en orden; el 92 % cuenta como visto", () => {
  const ids = ["s01e01", "s01e02", "s01e03", "s02e11"];
  const mapa: MapaProgreso = {
    "s01e01": { t: 2700, d: 2700, en: 100, visto: true },
    "s01e02": { t: 2600, d: 2700, en: 200, visto: false }, // pasó el 92 %
    "s01e03": { t: 900, d: 2700, en: 300, visto: false }, // a medias: falta
  };
  assert.deepEqual(sinVer(ids, mapa), ["s01e03", "s02e11"]);
  assert.deepEqual(sinVer(ids, {}), ids);
  mapa["s01e03"].visto = true;
  mapa["s02e11"] = { t: 2700, d: 2700, en: 400, visto: true };
  assert.deepEqual(sinVer(ids, mapa), []);
});

test("unoCualquiera: nunca el que se acaba de ver, y no se sale de la lista", () => {
  const ids = ["s01e01", "s01e02", "s02e11"];
  assert.equal(unoCualquiera(ids, "s02e11", 0), "s01e01");
  assert.equal(unoCualquiera(ids, "s02e11", 0.99), "s01e02");
  assert.equal(unoCualquiera(ids, "s02e11", 1), "s01e02", "1 no se pasa del final");
  assert.equal(unoCualquiera(ids, null, 0.5), "s01e02");
  for (let i = 0; i < 50; i++) assert.notEqual(unoCualquiera(ids, "s01e02"), "s01e02");
  assert.equal(unoCualquiera(["s02e11"], "s02e11", 0.3), null);
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

test("proximoDespues: el primero sin ver después del actual, y si no, desde el principio", () => {
  const ids = ["s01e01", "s01e02", "s01e03", "s01e04", "s01e05"];
  const visto = { t: 2400, d: 2400, en: 1, visto: true };
  const mapa: MapaProgreso = { s01e01: visto, s01e03: visto, s01e04: { t: 2300, d: 2400, en: 1, visto: false } };
  assert.equal(proximoDespues(ids, "s01e02", mapa), "s01e05", "el 3 está visto y el 4 pasó el 92 %");
  assert.equal(proximoDespues(ids, "s01e05", mapa), "s01e02", "después del último vuelve a empezar, sin el actual");
  assert.equal(proximoDespues(ids, "s01e05", mapa, ["s01e02"]), null);
  assert.equal(proximoDespues(ids, "s01e02", { ...mapa, s01e05: visto }), null, "sin contar el actual");
  assert.equal(proximoDespues(ids, "s01e09", {}), "s01e01", "un actual que no está en la lista no rompe");
});
