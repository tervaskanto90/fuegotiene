import { test } from "node:test";
import assert from "node:assert/strict";
import { anotarMejor, normalizarMejores, siguienteCaso } from "../lib/mejores.ts";

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

test("otro caso salta al siguiente que todavía no pasaste", () => {
  const ids = ["a", "b", "c", "d"];
  assert.equal(siguienteCaso(ids, "a", {}, 70), "b", "sin puntajes, el siguiente en orden");
  assert.equal(siguienteCaso(ids, "a", { b: 85, c: 70 }, 70), "d", "saltea los que llegaron al mínimo");
  assert.equal(siguienteCaso(ids, "c", { d: 90, a: 40 }, 70), "a", "da la vuelta");
  assert.equal(siguienteCaso(ids, "b", { c: 69 }, 70), "c", "69 no alcanza: no cuenta como pasado");
  assert.equal(siguienteCaso(ids, "b", { a: 80, c: 80, d: 80 }, 70), "c", "si sólo falta el abierto, el siguiente");
  assert.equal(siguienteCaso(ids, "d", { a: 80, b: 80, c: 80, d: 80 }, 70), "a", "todos pasados: el siguiente");
});
