import { test } from "node:test";
import assert from "node:assert/strict";
import { anotarMejor, normalizarMejores } from "../lib/mejores.ts";

test("el mejor puntaje sólo sube", () => {
  let m = anotarMejor({}, "panaderia", 54);
  assert.deepEqual(m, { panaderia: 54 });
  m = anotarMejor(m, "panaderia", 81);
  assert.equal(m.panaderia, 81);
  const igual = anotarMejor(m, "panaderia", 60);
  assert.equal(igual, m, "un puntaje peor no cambia nada");
  assert.equal(anotarMejor(m, "panaderia", 81), m);
  m = anotarMejor(m, "diploma", 0);
  assert.deepEqual(m, { panaderia: 81, diploma: 0 });
});

test("el mejor puntaje se acota a 0–100 y descarta lo que no es número", () => {
  assert.deepEqual(anotarMejor({}, "x", 140), { x: 100 });
  assert.deepEqual(anotarMejor({}, "x", -3), { x: 0 });
  assert.deepEqual(anotarMejor({}, "x", 70.6), { x: 71 });
  assert.deepEqual(anotarMejor({}, "x", Number.NaN), {});
});

test("lo guardado en el navegador se limpia al leerlo", () => {
  assert.deepEqual(normalizarMejores(null), {});
  assert.deepEqual(normalizarMejores([1, 2]), {});
  assert.deepEqual(normalizarMejores("82"), {});
  assert.deepEqual(normalizarMejores({ panaderia: 82, diploma: "90", masters: 300, terreno: null }), {
    panaderia: 82,
    masters: 100,
  });
});
