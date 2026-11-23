import { test } from "node:test";
import assert from "node:assert/strict";
import { textoCompartir } from "../lib/compartir.ts";

test("el texto de compartir dice el caso y el puntaje, no el plan", () => {
  assert.equal(
    textoCompartir("La panadería de la esquina", 85, 70),
    "Armé un operativo para «La panadería de la esquina» y sacó 85 sobre 100. Con 70 se abren los capítulos de Los Simuladores. ¿Vos cuánto sacás?",
  );
  assert.equal(
    textoCompartir("El informe ajeno", 70, 70),
    "Armé un operativo para «El informe ajeno» y sacó 70 sobre 100. Con 70 se abren los capítulos de Los Simuladores. ¿Vos cuánto sacás?",
  );
  assert.equal(
    textoCompartir("El informe ajeno", 52, 70),
    "Armé un operativo para «El informe ajeno» y sacó 52 sobre 100: me faltaron 18 para abrir los capítulos de Los Simuladores. ¿Vos cuánto sacás?",
  );
  assert.match(textoCompartir("X", 69, 70), /me faltó uno para/);
  assert.match(textoCompartir("X", 140, 70), /sacó 100 sobre 100\./);
  assert.match(textoCompartir("X", 81.6, 90), /sacó 82 sobre 100: me faltaron 8/);
});
