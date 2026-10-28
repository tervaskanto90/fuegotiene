import { test } from "node:test";
import assert from "node:assert/strict";
import { crearPase, idAnonimo, verificarPase } from "../lib/auth.ts";
import { conPase, decidirPuerta, MAX_PASES, normalizarPases, puntajeParaEntrar, type Pases } from "../lib/puerta.ts";

const secret = "un-secreto-de-prueba-largo-para-firmar-1234567890";
const config = { secret, codigos: ["codigo-de-octavio"], libres: [], duenos: [], version: "1" };
const otro = { secret: "otro-secreto-igual-de-largo-para-firmar-123456", codigos: [], libres: [], duenos: [], version: "1" };

test("el pase vale por sí mismo y dice quién lo ganó", async () => {
  // Desde que al sitio se entra sin código, el pase no depende de ninguna
  // sesión: es lo que deja pasar a quien llegó sin nada y ganó jugando.
  const pase = await crearPase("aBcD1234wXyZ", 82, config);
  assert.deepEqual(await verificarPase(pase, config), { id: "aBcD1234wXyZ", puntaje: 82 });
});

test("el pase no se puede falsificar ni con otro secreto ni a mano", async () => {
  const pase = await crearPase("aBcD1234wXyZ", 82, config);
  assert.equal(await verificarPase(pase, otro), null);
  // Subirse el puntaje editando la cookie invalida la firma.
  assert.equal(await verificarPase(pase.replace(".82.", ".99."), config), null);
  // Cambiarse el id, también.
  assert.equal(await verificarPase(pase.replace("aBcD1234wXyZ", "otroIdCualqui"), config), null);
  assert.equal(await verificarPase("cualquier.cosa", config), null);
  assert.equal(await verificarPase(undefined, config), null);
});

test("el pase vence", async () => {
  const hace200dias = Date.now() - 200 * 24 * 60 * 60 * 1000;
  const viejo = await crearPase("aBcD1234wXyZ", 82, config, hace200dias);
  assert.equal(await verificarPase(viejo, config), null);
  const reciente = await crearPase("aBcD1234wXyZ", 82, config);
  assert.equal((await verificarPase(reciente, config))?.puntaje, 82);
});

test("los ids anónimos son distintos y sirven como id de pase", async () => {
  const unos = new Set(Array.from({ length: 200 }, () => idAnonimo()));
  assert.equal(unos.size, 200, "no se repiten");
  const id = idAnonimo();
  const pase = await crearPase(id, 91, config);
  assert.deepEqual(await verificarPase(pase, config), { id, puntaje: 91 });
  // Y pasa la validación de pases.json, que es donde se anota.
  assert.deepEqual(Object.keys(normalizarPases({ [id]: { puntaje: 91, caso: "panaderia", fecha: 1 } })), [id]);
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

test("el registro de pases no crece para siempre", () => {
  // El sitio es público: cada visitante que gana deja una línea. Al llegar al
  // tope se van los más viejos, y el que se acaba de anotar nunca se cae.
  let pases: Pases = {};
  for (let i = 0; i < MAX_PASES + 30; i++) {
    pases = conPase(pases, `visitante${String(i).padStart(4, "0")}`, { puntaje: 80, caso: "panaderia", fecha: 1000 + i });
  }
  const ids = Object.keys(pases);
  assert.equal(ids.length, MAX_PASES);
  assert.ok(pases[`visitante${String(MAX_PASES + 29).padStart(4, "0")}`], "el último anotado está");
  assert.ok(!pases["visitante0000"], "el más viejo se fue");
});

// --- qué pide cada ruta (lo que aplica el middleware) ---

const nadie = null;
const comun = { libre: false, dueno: false };
const libre = { libre: true, dueno: false };
const dueno = { libre: true, dueno: true };
/** Un pase que anota si lo consultaron: las rutas públicas no deberían. */
function pase(tiene: boolean) {
  const p = { consultado: false, async tiene() { p.consultado = true; return tiene; } };
  return p;
}

test("lo público entra sin nada, y sin mirar el pase", async () => {
  for (const ruta of [
    "/juego", "/origen", "/entrar", "/api/simulacro", "/api/entrar", "/api/salir",
    "/demo/muestra.mp4", "/robots.txt",
    // Lo del teléfono: si esto rebota, el ícono de la pantalla de inicio queda en blanco.
    "/manifest.webmanifest", "/iconos/icono-192.png", "/iconos/icono-512-recortable.png", "/apple-icon.png",
    // La tarjeta de compartir: la pide el servidor del mensajero, sin cookies.
    "/opengraph-image.png",
  ]) {
    const p = pase(false);
    assert.deepEqual(await decidirPuerta(ruta, nadie, p.tiene), { tipo: "pasa" }, ruta);
    assert.equal(p.consultado, false, `${ruta} no tiene por qué mirar el pase`);
  }
});

test("público es exacto: parecidos no entran", async () => {
  for (const ruta of ["/juegos", "/origen/2", "/juego/", "/entrar2", "/api/simulacro/x", "/manifest.webmanifest.bak", "/apple-icon.png/x", "/opengraph-image.png.bak", "/opengraph-image"]) {
    assert.notDeepEqual(await decidirPuerta(ruta, nadie, () => false), { tipo: "pasa" }, ruta);
  }
});

test("quien ya tiene sesión no vuelve a /entrar", async () => {
  assert.deepEqual(await decidirPuerta("/entrar", comun, () => false), { tipo: "redirige", a: "/" });
  assert.deepEqual(await decidirPuerta("/entrar", nadie, () => true), { tipo: "pasa" }, "con pase y sin código, sí");
});

test("el mantenimiento es del dueño: ganar el juego no abre el bucket", async () => {
  for (const ruta of ["/estado", "/subir"]) {
    assert.deepEqual(await decidirPuerta(ruta, nadie, () => true), { tipo: "redirige", a: "/" }, ruta);
    assert.deepEqual(await decidirPuerta(ruta, libre, () => true), { tipo: "redirige", a: "/" }, `${ruta} con código libre`);
    assert.deepEqual(await decidirPuerta(ruta, dueno, () => false), { tipo: "pasa" }, `${ruta} con el dueño`);
  }
  for (const ruta of ["/api/estado", "/api/subir"]) {
    const d = await decidirPuerta(ruta, libre, () => true);
    assert.equal(d.tipo, "rechaza", `${ruta} contesta JSON, no redirige`);
    assert.deepEqual(await decidirPuerta(ruta, dueno, () => false), { tipo: "pasa" }, ruta);
  }
  // El diagnóstico de un capítulo no es del dueño: el reproductor lo usa en
  // la pantalla de cualquiera.
  assert.deepEqual(await decidirPuerta("/api/estado/s01e01", nadie, () => true), { tipo: "pasa" });
  assert.equal((await decidirPuerta("/api/estado/s01e01", nadie, () => false)).tipo, "rechaza");
});

test("los capítulos piden el juego ganado o un código que se lo saltee", async () => {
  const paginas = ["/", "/ver/s01e01", "/expediente", "/capitulos", "/cualquier-cosa"];
  const apis = ["/api/stream/s01e01", "/api/stream/s01e01/sub", "/api/marcas", "/api/arte/s01e01"];
  for (const ruta of [...paginas, ...apis]) {
    assert.deepEqual(await decidirPuerta(ruta, nadie, () => true), { tipo: "pasa" }, `${ruta} con pase`);
    const p = pase(false);
    assert.deepEqual(await decidirPuerta(ruta, libre, p.tiene), { tipo: "pasa" }, `${ruta} con código libre`);
    assert.equal(p.consultado, false, "con código libre no hace falta mirar el pase");
    assert.deepEqual(await decidirPuerta(ruta, dueno, () => false), { tipo: "pasa" }, `${ruta} con el dueño`);
  }
  for (const ruta of paginas) {
    assert.deepEqual(await decidirPuerta(ruta, nadie, () => false), { tipo: "redirige", a: "/juego" }, ruta);
    assert.deepEqual(await decidirPuerta(ruta, comun, () => false), { tipo: "redirige", a: "/juego" }, `${ruta}: un código común no se saltea el juego`);
  }
  for (const ruta of apis) {
    const d = await decidirPuerta(ruta, comun, () => false);
    assert.equal(d.tipo, "rechaza", ruta);
    assert.match(d.tipo === "rechaza" ? d.error : "", /juego/, "el 403 dice por qué");
  }
});
