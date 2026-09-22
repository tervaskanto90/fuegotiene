import { test } from "node:test";
import assert from "node:assert/strict";
import { crearPase, verificarPase } from "../lib/auth.ts";
import { conPase, normalizarPases, puntajeParaEntrar, type Pases } from "../lib/puerta.ts";

const secret = "un-secreto-de-prueba-largo-para-firmar-1234567890";
const config = { secret, codigos: ["codigo-de-octavio"], libres: [] };
const otro = { secret: "otro-secreto-igual-de-largo-para-firmar-123456", codigos: [], libres: [] };

test("el pase abre sólo para el id que lo ganó", async () => {
  const pase = await crearPase("id-de-octavio", 82, config);
  assert.equal(await verificarPase(pase, "id-de-octavio", config), 82);
  // La misma cookie en la sesión de otra persona no sirve.
  assert.equal(await verificarPase(pase, "id-de-mama", config), null);
});

test("el pase no se puede falsificar ni con otro secreto ni a mano", async () => {
  const pase = await crearPase("id-de-octavio", 82, config);
  assert.equal(await verificarPase(pase, "id-de-octavio", otro), null);
  // Subirse el puntaje editando la cookie invalida la firma.
  const inflado = pase.replace(".82.", ".99.");
  assert.equal(await verificarPase(inflado, "id-de-octavio", config), null);
  assert.equal(await verificarPase("cualquier.cosa", "id-de-octavio", config), null);
  assert.equal(await verificarPase(undefined, "id-de-octavio", config), null);
});

test("el pase vence", async () => {
  const hace200dias = Date.now() - 200 * 24 * 60 * 60 * 1000;
  const viejo = await crearPase("id-de-octavio", 82, config, hace200dias);
  assert.equal(await verificarPase(viejo, "id-de-octavio", config), null);
  const reciente = await crearPase("id-de-octavio", 82, config);
  assert.equal(await verificarPase(reciente, "id-de-octavio", config), 82);
});

test("el puntaje para entrar sale de la variable, con un default sensato", () => {
  assert.equal(puntajeParaEntrar({}), 70);
  assert.equal(puntajeParaEntrar({ PUNTAJE_PARA_ENTRAR: "55" }), 55);
  assert.equal(puntajeParaEntrar({ PUNTAJE_PARA_ENTRAR: "  90 " }), 90);
  // Cualquier disparate vuelve al default en vez de dejar la puerta abierta.
  assert.equal(puntajeParaEntrar({ PUNTAJE_PARA_ENTRAR: "0" }), 70);
  assert.equal(puntajeParaEntrar({ PUNTAJE_PARA_ENTRAR: "-5" }), 70);
  assert.equal(puntajeParaEntrar({ PUNTAJE_PARA_ENTRAR: "500" }), 70);
  assert.equal(puntajeParaEntrar({ PUNTAJE_PARA_ENTRAR: "muchos" }), 70);
});

test("pases.json descarta lo que no tiene forma de pase", () => {
  const pases = normalizarPases({
    "abcd1234abcd1234": { puntaje: 82, caso: "morosos", fecha: 1750000000000 },
    "otro-id-valido-1": { puntaje: 71 },
    "id malo con espacios": { puntaje: 90 },
    "efgh5678efgh5678": { puntaje: 900 },
    "ijkl9012ijkl9012": { puntaje: "muchos" },
    "mnop3456mnop3456": null,
  });
  assert.deepEqual(Object.keys(pases).sort(), ["abcd1234abcd1234", "otro-id-valido-1"]);
  assert.equal(pases["abcd1234abcd1234"].caso, "morosos");
  assert.equal(pases["otro-id-valido-1"].caso, "");
  assert.ok(pases["otro-id-valido-1"].fecha > 0);
  assert.deepEqual(normalizarPases(null), {});
  assert.deepEqual(normalizarPases("[]"), {});
});

test("un pase nuevo no pisa uno mejor", () => {
  const base: Pases = { octavio: { puntaje: 88, caso: "morosos", fecha: 1 } };
  const peor = conPase(base, "octavio", { puntaje: 71, caso: "terreno", fecha: 2 });
  assert.equal(peor, base, "si no mejora, devuelve el mismo objeto y no hay que reescribir el JSON");
  const mejor = conPase(base, "octavio", { puntaje: 95, caso: "terreno", fecha: 3 });
  assert.equal(mejor.octavio.puntaje, 95);
  assert.equal(mejor.octavio.caso, "terreno");
  const nuevo = conPase(base, "mama", { puntaje: 72, caso: "obra", fecha: 4 });
  assert.equal(nuevo.mama.puntaje, 72);
  assert.equal(nuevo.octavio.puntaje, 88, "el de al lado queda intacto");
});
