import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

type Ep = { id: string; temporada: number; numero: number; titulo: string; emision: string; key: string };

const datos = JSON.parse(readFileSync(path.join(import.meta.dirname, "..", "data", "episodes.json"), "utf8")) as Ep[];

test("hay 24 capítulos: 13 en la temporada 1 y 11 en la 2", () => {
  assert.equal(datos.length, 24);
  assert.equal(datos.filter((e) => e.temporada === 1).length, 13);
  assert.equal(datos.filter((e) => e.temporada === 2).length, 11);
});

test("ids, keys y numeración consistentes", () => {
  const ids = new Set(datos.map((e) => e.id));
  const keys = new Set(datos.map((e) => e.key));
  assert.equal(ids.size, 24);
  assert.equal(keys.size, 24);
  for (const e of datos) {
    assert.equal(e.id, `s${String(e.temporada).padStart(2, "0")}e${String(e.numero).padStart(2, "0")}`);
    assert.ok(e.titulo.trim().length > 0, `${e.id} sin título`);
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(e.emision) || e.emision === "", `${e.id} fecha rara: ${e.emision}`);
    assert.ok(!/[?#%]/.test(e.key), `${e.id} key con caracteres problemáticos`);
  }
  for (const t of [1, 2]) {
    const numeros = datos.filter((e) => e.temporada === t).map((e) => e.numero).sort((a, b) => a - b);
    assert.deepEqual(numeros, numeros.map((_, i) => i + 1), `temporada ${t} con huecos`);
  }
});
