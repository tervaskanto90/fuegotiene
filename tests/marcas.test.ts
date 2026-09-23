import { test } from "node:test";
import assert from "node:assert/strict";
import { conArte, esInterno, keyArte, normalizarMarcas } from "../lib/marcas.ts";

test("normalizarMarcas descarta lo que no tiene forma", () => {
  const m = normalizarMarcas({
    s01e01: { arte: 1700000000000 },
    s01e02: { arte: 0 },
    s01e03: { arte: "x" },
    "../x": { arte: 123 },
    s02e11: { arte: 1.9 },
  });
  assert.deepEqual(m, { s01e01: { arte: 1700000000000 }, s02e11: { arte: 1 } });
  assert.deepEqual(normalizarMarcas(null), {});
  assert.deepEqual(normalizarMarcas("hola"), {});
});

test("normalizarMarcas se olvida de la intro, que ya no la escribe nadie", () => {
  // Los marcas.json viejos traen el campo; se lee lo que sirve y lo otro cae.
  assert.deepEqual(normalizarMarcas({ s01e01: { intro: [5, 60], arte: 123 } }), { s01e01: { arte: 123 } });
  assert.deepEqual(normalizarMarcas({ s01e01: { intro: [5, 60] } }), {});
});

test("conArte anota la versión sin tocar el resto", () => {
  const m = conArte({ s01e02: { arte: 1 } }, "s01e01", 123);
  assert.deepEqual(m, { s01e02: { arte: 1 }, s01e01: { arte: 123 } });
  assert.deepEqual(conArte(m, "s01e01", 456).s01e01, { arte: 456 });
});

test("keyArte y esInterno", () => {
  assert.equal(keyArte("s01e01"), "art/s01e01.jpg");
  assert.ok(esInterno("marcas.json") && esInterno("art/s01e01.jpg") && !esInterno("s01e01.mp4"));
});

test("elegirMomento: pasado el arranque y siempre dentro del video", async () => {
  const { elegirMomento } = await import("../lib/cuadro.ts");
  assert.equal(elegirMomento(2700), 300);
  assert.equal(elegirMomento(600), 72);
  assert.equal(elegirMomento(20), 10);
  assert.equal(elegirMomento(null), 60);
});
