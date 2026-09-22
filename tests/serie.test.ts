import { test } from "node:test";
import assert from "node:assert/strict";
import { laSerie, metodo, simuladores, szifron } from "../lib/serie.ts";

test("las cuatro fichas están completas y con el reparto correcto", () => {
  assert.equal(simuladores.length, 4);
  const pares = simuladores.map((f) => `${f.personaje} / ${f.actor}`);
  assert.deepEqual(pares, [
    "Mario Santos / Federico D'Elía",
    "Emilio Ravenna / Diego Peretti",
    "Pablo Lamponne / Alejandro Fiore",
    "Gabriel Medina / Martín Seefeld",
  ]);
  for (const f of simuladores) {
    assert.match(f.numero, /^0[1-4]$/);
    assert.ok(f.rol.length > 3, f.id);
    assert.ok(f.datos.length >= 3, f.id);
    assert.ok(f.delPersonaje.length >= 2 && f.delActor.length >= 2, f.id);
    for (const p of [...f.delPersonaje, ...f.delActor]) assert.ok(p.length > 120, `${f.id}: párrafo corto`);
  }
  assert.equal(new Set(simuladores.map((f) => f.id)).size, 4);
});

test("la serie y el método", () => {
  assert.ok(laSerie.texto.length >= 2);
  const capitulos = laSerie.datos.find((d) => d.clave === "capítulos");
  assert.equal(capitulos?.valor, "24: 13 y 11");
  assert.equal(metodo.length, 5);
  assert.deepEqual(
    metodo.map((m) => m.numero),
    ["01", "02", "03", "04", "05"],
  );
});

test("szifrón", () => {
  assert.equal(szifron.nombre, "Damián Szifrón");
  assert.ok(szifron.hitos.length >= 4);
  const anios = szifron.hitos.map((h) => Number(h.anio));
  assert.deepEqual(anios, [...anios].sort((a, b) => a - b), "los hitos van en orden");
  assert.ok(anios.every((a) => a >= 2002 && a <= 2026));
});
