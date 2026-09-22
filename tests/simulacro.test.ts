import { test } from "node:test";
import assert from "node:assert/strict";
import { buscarCaso, casos, contarPalabras, evaluarPlan, MAX_PLAN } from "../lib/simulacro.ts";

const caso = casos[0];

const PLAN_COMPLETO = `Primero Medina investiga al dueño del local: a qué hora entra, con quién almuerza,
qué deudas tiene y de qué se jacta. Con esos datos Santos arma el operativo. Lamponne consigue una oficina en
el centro, papeles con sello y una camioneta con el logo. Ravenna se hace pasar por un perito tasador de una
cadena mucho más grande, y se presenta el martes a las diez. El día del operativo cada uno está en su puesto:
mientras Ravenna lo entretiene, Medina deja el expediente sobre el escritorio. Si sospecha, por las dudas
tenemos un segundo tasador listo para llamar. Cuando firma, levantamos todo, se desarma la oficina y nadie
vuelve a vernos: no queda rastro.`;

test("un plan vacío no es un operativo", () => {
  const r = evaluarPlan(caso, "");
  assert.equal(r.veredicto, "vacio");
  assert.equal(r.puntaje, 0);
  assert.equal(r.fases.length, 1);
  assert.equal(r.tuvo.length, 0);
  assert.ok(r.falto.length > 0);
  assert.equal(evaluarPlan(caso, "hacer algo").veredicto, "vacio");
});

test("un plan con todas las piezas sale redondo", () => {
  const r = evaluarPlan(caso, PLAN_COMPLETO);
  assert.equal(r.veredicto, "redondo");
  assert.ok(r.puntaje >= 78, `puntaje ${r.puntaje}`);
  assert.equal(r.fases.length, 4);
  assert.deepEqual(
    r.fases.map((f) => f.titulo),
    ["el estudio", "el montaje", "el operativo", "la salida"],
  );
  assert.equal(r.falto.length, 0);
  assert.equal(r.porQuien, "local");
  for (const f of r.fases) assert.ok(f.texto.length > 40, f.titulo);
});

test("la violencia hunde el operativo por más completo que esté", () => {
  const r = evaluarPlan(caso, `${PLAN_COMPLETO} Si no afloja lo amenazamos y le pegamos un susto.`);
  assert.ok(r.puntaje < evaluarPlan(caso, PLAN_COMPLETO).puntaje - 30);
  assert.ok(r.falto.some((f) => /violencia/.test(f)));
  assert.match(r.fases[2].texto, /no (lo )?hace|línea|no laburamos así/i);
});

test("ir a la policía o hablarle de frente no es un operativo", () => {
  const frontal = evaluarPlan(caso, `${PLAN_COMPLETO} Igual primero hay que hablar con él y decirle la verdad.`);
  assert.ok(frontal.falto.some((f) => /de frente/.test(f)));
  const judicial = evaluarPlan(caso, `${PLAN_COMPLETO} Si no, hacer la denuncia y meter un juicio.`);
  assert.ok(judicial.falto.some((f) => /justicia|polic/.test(f)));
});

test("un plan a medias queda en el medio de la tabla", () => {
  const r = evaluarPlan(
    caso,
    `Ravenna se hace pasar por un inversor interesado en el local y le hace una oferta muy alta,
     para que el dueño se entusiasme. Después no aparece más y el dueño se queda sin la cadena y sin él.`,
  );
  assert.ok(["raspando", "sale"].includes(r.veredicto), r.veredicto);
  assert.ok(r.tuvo.length > 0 && r.falto.length > 0);
});

test("el mismo plan da siempre el mismo relato", () => {
  const a = evaluarPlan(caso, PLAN_COMPLETO);
  const b = evaluarPlan(caso, PLAN_COMPLETO);
  assert.deepEqual(a, b);
});

test("planes distintos no se narran todos igual", () => {
  // Cada fase elige entre varias variantes según un hash del texto, así que
  // dos planes sueltos pueden coincidir; sobre un conjunto, no.
  const variantes = Array.from({ length: 14 }, (_, i) => `${PLAN_COMPLETO} Detalle número ${i} del operativo.`);
  const resultados = variantes.map((v) => evaluarPlan(caso, v));
  for (const r of resultados) assert.equal(r.veredicto, "redondo");
  for (let f = 0; f < 4; f++) {
    const distintas = new Set(resultados.map((r) => r.fases[f].texto));
    assert.ok(distintas.size >= 2, `la fase ${f} se narró siempre igual en 14 planes`);
  }
});

test("el mismo plan se lee igual en cualquier caso, pero nombra al cliente de ese caso", () => {
  for (const c of casos) {
    const r = evaluarPlan(
      c,
      `Hay que encontrarle la vuelta a este asunto sin hacer demasiado ruido ni complicarse la vida,
       buscando que la cosa se acomode sola con el tiempo y que todo el mundo quede tranquilo al final.`,
    );
    assert.equal(r.veredicto, "se-cae");
    const nombre = c.cliente.split(",")[0];
    assert.ok(
      [...r.fases.map((f) => f.texto), r.nota].some((t) => t.includes(nombre)),
      `${c.id} no nombra a ${nombre}`,
    );
  }
});

test("un texto gigante no rompe nada", () => {
  const r = evaluarPlan(caso, PLAN_COMPLETO + " relleno".repeat(5000));
  assert.ok(r.puntaje <= 100 && r.puntaje >= 0);
  assert.equal(r.fases.length, 4);
  assert.ok(MAX_PLAN < 10000);
});

test("los seis casos están completos y son distintos", () => {
  assert.equal(casos.length, 6);
  assert.equal(new Set(casos.map((c) => c.id)).size, 6);
  for (const c of casos) {
    assert.ok(c.titulo && c.cliente.includes(","), c.id);
    assert.ok(c.problema.length > 80 && c.objetivo.length > 20, c.id);
    assert.ok(c.limites.length >= 3, c.id);
    assert.equal(buscarCaso(c.id), c);
  }
  assert.equal(buscarCaso("no-existe"), undefined);
});

test("contarPalabras", () => {
  assert.equal(contarPalabras(""), 0);
  assert.equal(contarPalabras("   "), 0);
  assert.equal(contarPalabras("uno dos  tres\ncuatro"), 4);
});

test("la violencia se detecta en todas sus formas", () => {
  const formas = [
    "lo amenazamos con contarle todo a la familia",
    "que alguien lo amenace por teléfono",
    "le mandamos a un par a que lo apreten",
    "hay que meterle miedo para que afloje",
    "le pegamos un susto en la puerta de la casa",
    "conseguimos un arma para asustarlo",
    "si no, lo secuestramos un rato",
  ];
  for (const f of formas) {
    const r = evaluarPlan(
      caso,
      `${f}. Después de eso seguimos con el resto del plan, que ya está armado y coordinado entre todos nosotros desde hace rato.`,
    );
    assert.ok(
      r.falto.some((x) => /violencia/.test(x)),
      `no detectó violencia en: ${f}`,
    );
  }
});
