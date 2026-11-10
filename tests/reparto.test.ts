import { test } from "node:test";
import assert from "node:assert/strict";
import reparto from "../data/reparto.json" with { type: "json" };
import episodios from "../data/episodes.json" with { type: "json" };

const datos = reparto as Record<string, { invitados: { actor: string; personaje: string }[]; tambien: string[] }>;
const eps = episodios as { id: string; titulo: string }[];

test("los 24 capítulos tienen su reparto", () => {
  assert.equal(eps.length, 24);
  for (const e of eps) {
    assert.ok(datos[e.id], `falta el reparto de ${e.id}`);
    const total = datos[e.id].invitados.length + datos[e.id].tambien.length;
    assert.ok(total > 0, `${e.id} quedó sin un solo nombre`);
  }
  // Y no hay entradas de más, apuntando a capítulos que no existen.
  assert.deepEqual(Object.keys(datos).sort(), eps.map((e) => e.id).sort());
});

test("los cuatro protagonistas no figuran como invitados", () => {
  // Están en los 24: listarlos como invitados sería un error de extracción.
  const principales = ["Federico D'Elía", "Alejandro Fiore", "Diego Peretti", "Martín Seefeld"];
  for (const [id, r] of Object.entries(datos)) {
    for (const nombre of [...r.invitados.map((i) => i.actor), ...r.tambien]) {
      assert.ok(!principales.includes(nombre), `${nombre} aparece como invitado en ${id}`);
    }
  }
});

test("ningún nombre se repite dentro del mismo capítulo", () => {
  for (const [id, r] of Object.entries(datos)) {
    const todos = [...r.invitados.map((i) => i.actor), ...r.tambien];
    assert.equal(new Set(todos).size, todos.length, `hay un nombre repetido en ${id}`);
  }
});

test("los nombres tienen forma de nombre", () => {
  // Atajo contra la basura que dejaba la extracción: nada de frases sueltas.
  for (const [id, r] of Object.entries(datos)) {
    for (const nombre of [...r.invitados.map((i) => i.actor), ...r.tambien]) {
      assert.match(nombre, /^[A-ZÁÉÍÓÚÑ]/, `"${nombre}" en ${id} no arranca como un nombre`);
      assert.ok(nombre.split(/\s+/).length <= 4, `"${nombre}" en ${id} es muy largo para ser un nombre`);
    }
    for (const i of r.invitados) {
      assert.ok(i.personaje.split(/\s+/).length <= 4, `el personaje "${i.personaje}" de ${id} es una frase`);
    }
  }
});

test("la Brigada B es la gente que más vuelve", () => {
  // El hallazgo que cuenta la sección: los cuatro que más aparecen son los
  // cuatro del equipo paralelo, y tres empezaron siendo clientes.
  const cuenta = new Map<string, number>();
  for (const r of Object.values(datos)) {
    for (const n of [...r.invitados.map((i) => i.actor), ...r.tambien]) {
      cuenta.set(n, (cuenta.get(n) ?? 0) + 1);
    }
  }
  const top = [...cuenta.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([a]) => a);
  assert.deepEqual(
    top.sort(),
    ["Fernando Sureda", "Jorge D'Elía", "Juan Carlos Ricci", "Pasta Dioguardi"],
    "cambió quiénes son los cuatro que más vuelven: revisá el texto de la sección",
  );
});

test("recurrentes() dice en qué capítulos aparece cada cara, en orden de emisión", async () => {
  const { recurrentes } = await import("../lib/reparto.ts");
  const orden = eps.map((e) => e.id);
  const lista = recurrentes();
  assert.ok(lista.length > 0);
  for (const r of lista) {
    assert.equal(r.ids.length, r.capitulos, `${r.actor}: la cuenta no coincide con los ids`);
    assert.ok(r.capitulos >= 3, `${r.actor} aparece en menos de 3`);
    assert.equal(new Set(r.ids).size, r.ids.length, `${r.actor} tiene un capítulo repetido`);
    const posiciones = r.ids.map((id) => orden.indexOf(id));
    assert.ok(posiciones.every((p) => p >= 0), `${r.actor} nombra un capítulo que no existe`);
    assert.deepEqual(posiciones, [...posiciones].sort((a, b) => a - b), `${r.actor}: los capítulos no van en orden`);
    for (const id of r.ids) {
      const nombres = [...datos[id].invitados.map((i) => i.actor), ...datos[id].tambien];
      assert.ok(nombres.includes(r.actor), `${r.actor} no está en el reparto de ${id}`);
    }
  }
  // Ordenadas de más a menos: arriba los cuatro de la Brigada B.
  for (let i = 1; i < lista.length; i++) assert.ok(lista[i - 1].capitulos >= lista[i].capitulos);
  assert.deepEqual(
    lista.slice(0, 4).map((r) => r.actor).sort(),
    ["Fernando Sureda", "Jorge D'Elía", "Juan Carlos Ricci", "Pasta Dioguardi"],
  );
});
