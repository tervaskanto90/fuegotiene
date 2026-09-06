import { test } from "node:test";
import assert from "node:assert/strict";
import { conArte, conIntro, enIntro, esInterno, keyArte, normalizarMarcas, validarIntro } from "../lib/marcas.ts";

test("validarIntro exige dos números, en orden y acotados", () => {
  assert.deepEqual(validarIntro([10, 70.26]), [10, 70.3]);
  assert.equal(validarIntro([70, 10]), null);
  assert.equal(validarIntro([-1, 10]), null);
  assert.equal(validarIntro([0, 601]), null);
  assert.equal(validarIntro([10]), null);
  assert.equal(validarIntro(["10", "20"]), null);
  assert.equal(validarIntro(null), null);
});

test("normalizarMarcas descarta lo que no tiene forma", () => {
  const m = normalizarMarcas({
    s01e01: { intro: [5, 60], arte: 1700000000000 },
    s01e02: { intro: [60, 5] },
    s01e03: { arte: "x" },
    "../x": { intro: [1, 2] },
    s02e11: { intro: [0, 30] },
  });
  assert.deepEqual(m, { s01e01: { intro: [5, 60], arte: 1700000000000 }, s02e11: { intro: [0, 30] } });
  assert.deepEqual(normalizarMarcas(null), {});
  assert.deepEqual(normalizarMarcas("hola"), {});
});

test("conIntro y conArte no pisan lo otro", () => {
  let m = conIntro({}, "s01e01", [5, 60]);
  m = conArte(m, "s01e01", 123);
  assert.deepEqual(m, { s01e01: { intro: [5, 60], arte: 123 } });
  m = conIntro(m, "s01e01", null);
  assert.deepEqual(m, { s01e01: { arte: 123 } });
  assert.deepEqual(conIntro({ s01e01: { intro: [1, 2] } }, "s01e01", null), {});
});

test("enIntro, keyArte y esInterno", () => {
  assert.ok(enIntro([5, 60], 5));
  assert.ok(enIntro([5, 60], 59.4));
  assert.ok(!enIntro([5, 60], 59.6));
  assert.ok(!enIntro([5, 60], 4.9));
  assert.ok(!enIntro(undefined, 10));
  assert.equal(keyArte("s01e01"), "art/s01e01.jpg");
  assert.ok(esInterno("marcas.json") && esInterno("art/s01e01.jpg") && !esInterno("s01e01.mp4"));
});

test("elegirMomento: después de la intro, o pasado el arranque, siempre dentro del video", async () => {
  const { elegirMomento } = await import("../lib/cuadro.ts");
  assert.equal(elegirMomento(2700, undefined), 300);
  assert.equal(elegirMomento(600, undefined), 72);
  assert.equal(elegirMomento(2700, [100, 160]), 180);
  assert.equal(elegirMomento(20, undefined), 10);
  assert.equal(elegirMomento(null, undefined), 60);
  assert.equal(elegirMomento(50, [10, 48]), 25);
});
