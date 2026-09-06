import { test } from "node:test";
import assert from "node:assert/strict";
import {
  crearSesion,
  iguales,
  leerConfig,
  opcionesCookie,
  parsearCodigos,
  rutaSegura,
  verificarSesion,
  DURACION_SESION_S,
} from "../lib/auth.ts";

const secret = "un-secreto-de-prueba-largo-para-firmar-1234567890";
const config = { secret, codigos: ["codigo-de-octavio", "codigo-de-mama"] };

test("leerConfig explica qué falta", () => {
  assert.match((leerConfig({}) as { problema: string }).problema, /SESSION_SECRET/);
  assert.match((leerConfig({ SESSION_SECRET: "corto" }) as { problema: string }).problema, /muy corto/);
  assert.match((leerConfig({ SESSION_SECRET: secret }) as { problema: string }).problema, /ACCESS_CODES/);
  assert.match(
    (leerConfig({ SESSION_SECRET: secret, ACCESS_CODES: "abc" }) as { problema: string }).problema,
    /al menos 6/,
  );
  const ok = leerConfig({ SESSION_SECRET: secret, ACCESS_CODES: " uno-dos-tres, cuatro-cinco ;seis-siete\nocho-nueve" });
  assert.ok(ok.ok);
  assert.deepEqual(ok.config.codigos, ["uno-dos-tres", "cuatro-cinco", "seis-siete", "ocho-nueve"]);
});

test("parsearCodigos ignora vacíos y repetidos", () => {
  assert.deepEqual(parsearCodigos("a-b-c,,a-b-c, d-e-f "), ["a-b-c", "d-e-f"]);
  assert.deepEqual(parsearCodigos(undefined), []);
});

test("un código válido crea una sesión que verifica", async () => {
  const token = await crearSesion("codigo-de-mama", config);
  assert.ok(token);
  const sesion = await verificarSesion(token, config);
  assert.ok(sesion);
  assert.ok(sesion.vence > Date.now() / 1000 + DURACION_SESION_S - 60);
});

test("un código inválido no crea sesión", async () => {
  assert.equal(await crearSesion("otro", config), null);
  assert.equal(await crearSesion("", config), null);
  assert.equal(await crearSesion("codigo-de-mam", config), null);
});

test("la firma se verifica de verdad", async () => {
  const token = (await crearSesion("codigo-de-octavio", config))!;
  const partes = token.split(".");
  // vencimiento cambiado
  partes[2] = String(Number(partes[2]) + 1000);
  assert.equal(await verificarSesion(partes.join("."), config), null);
  // firma cambiada
  const roto = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
  assert.equal(await verificarSesion(roto, config), null);
  // otro secreto
  assert.equal(await verificarSesion(token, { ...config, secret: secret + "x" }), null);
  // basura
  assert.equal(await verificarSesion("v1.x.y", config), null);
  assert.equal(await verificarSesion(undefined, config), null);
});

test("vencida no sirve", async () => {
  const hace = Date.now() - (DURACION_SESION_S + 10) * 1000;
  const token = (await crearSesion("codigo-de-octavio", config, hace))!;
  assert.equal(await verificarSesion(token, config), null);
  assert.ok(await verificarSesion(token, config, hace + 1000));
});

test("sacar el código de ACCESS_CODES desloguea", async () => {
  const token = (await crearSesion("codigo-de-mama", config))!;
  assert.ok(await verificarSesion(token, config));
  assert.equal(await verificarSesion(token, { secret, codigos: ["codigo-de-octavio"] }), null);
});

test("iguales compara sin sorpresas", () => {
  assert.ok(iguales("abc", "abc"));
  assert.ok(!iguales("abc", "abd"));
  assert.ok(!iguales("abc", "abcd"));
});

test("rutaSegura sólo acepta rutas internas", () => {
  assert.equal(rutaSegura("/ver/s01e01"), "/ver/s01e01");
  assert.equal(rutaSegura("https://otro.sitio"), "/");
  assert.equal(rutaSegura("//otro.sitio"), "/");
  assert.equal(rutaSegura("/api/stream/x"), "/");
  assert.equal(rutaSegura("/entrar?error=1"), "/");
  assert.equal(rutaSegura("/api"), "/");
  assert.equal(rutaSegura(null), "/");
  assert.equal(rutaSegura({}), "/");
  // caracteres de control: el navegador los saca y "/\t/evil.com" pasa a ser "//evil.com"
  assert.equal(rutaSegura("/\t/evil.com"), "/");
  assert.equal(rutaSegura("/\n/evil.com"), "/");
  assert.equal(rutaSegura("/\r/evil.com"), "/");
  assert.equal(rutaSegura("/\\evil.com"), "/");
  assert.equal(rutaSegura("/ver/s01e01?seguir=1"), "/ver/s01e01?seguir=1");
  assert.equal(rutaSegura("/ver/s01e01#x"), "/ver/s01e01");
});

test("la cookie no deja adivinar el código: el id depende del secreto", async () => {
  const a = (await crearSesion("codigo-de-mama", config))!.split(".")[1];
  const b = (await crearSesion("codigo-de-mama", { ...config, secret: secret + "otro" }))!.split(".")[1];
  assert.notEqual(a, b);
  assert.equal(a.length, 16);
});

test("opcionesCookie", () => {
  assert.deepEqual(opcionesCookie(true), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: DURACION_SESION_S });
  assert.equal(opcionesCookie(false).secure, false);
});
