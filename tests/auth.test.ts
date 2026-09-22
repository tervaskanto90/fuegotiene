import { test } from "node:test";
import assert from "node:assert/strict";
import {
  crearPase,
  crearSesion,
  iguales,
  leerConfig,
  opcionesCookie,
  parsearCodigos,
  rutaSegura,
  verificarPase,
  verificarSesion,
  DURACION_SESION_S,
} from "../lib/auth.ts";

const secret = "un-secreto-de-prueba-largo-para-firmar-1234567890";
const config = { secret, codigos: ["codigo-de-octavio", "codigo-de-mama"], libres: [], duenos: [], version: "1" };

test("leerConfig explica qué falta", () => {
  assert.match((leerConfig({}) as { problema: string }).problema, /SESSION_SECRET/);
  assert.match((leerConfig({ SESSION_SECRET: "corto" }) as { problema: string }).problema, /muy corto/);
  // Un sitio sin ningún código es válido: al sitio se entra sin nada y el
  // juego abre los capítulos. Los códigos son para saltearlo o para el
  // mantenimiento.
  const sinCodigos = leerConfig({ SESSION_SECRET: secret });
  assert.ok(sinCodigos.ok);
  assert.deepEqual(sinCodigos.config.codigos, []);
  assert.match(
    (leerConfig({ SESSION_SECRET: secret, ACCESS_CODES: "abc" }) as { problema: string }).problema,
    /al menos 8/,
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

test("CODIGOS_LIBRES marca a quien no tiene que pasar por el juego", async () => {
  const env = {
    SESSION_SECRET: secret,
    ACCESS_CODES: "codigo-de-octavio, codigo-de-mama",
    CODIGOS_LIBRES: "codigo-de-octavio",
  };
  const leido = leerConfig(env);
  assert.ok(leido.ok);
  assert.deepEqual(leido.config.libres, ["codigo-de-octavio"]);

  const deOctavio = await crearSesion("codigo-de-octavio", leido.config);
  const deMama = await crearSesion("codigo-de-mama", leido.config);
  assert.equal((await verificarSesion(deOctavio, leido.config))?.libre, true);
  assert.equal((await verificarSesion(deMama, leido.config))?.libre, false);

  // Sin la variable no hay libres: todos juegan.
  const sinLibres = leerConfig({ SESSION_SECRET: secret, ACCESS_CODES: "codigo-de-octavio" });
  assert.ok(sinLibres.ok);
  assert.deepEqual(sinLibres.config.libres, []);
});

test("un código que sólo está en CODIGOS_LIBRES igual entra", async () => {
  // El caso real: se cargó la clave nueva en CODIGOS_LIBRES y no en
  // ACCESS_CODES, y el login la rechazaba sin decir por qué.
  const env = {
    SESSION_SECRET: secret,
    ACCESS_CODES: "codigo-viejo-de-siempre",
    CODIGOS_LIBRES: "clave-nueva-del-dueno",
  };
  const leido = leerConfig(env);
  assert.ok(leido.ok);
  assert.deepEqual(leido.config.codigos, ["codigo-viejo-de-siempre", "clave-nueva-del-dueno"]);

  const nueva = await crearSesion("clave-nueva-del-dueno", leido.config);
  assert.ok(nueva, "la clave nueva entra");
  assert.equal((await verificarSesion(nueva, leido.config))?.libre, true, "y además pasa la puerta sin jugar");

  const vieja = await crearSesion("codigo-viejo-de-siempre", leido.config);
  assert.equal((await verificarSesion(vieja, leido.config))?.libre, false, "la de siempre sigue jugando");

  // Escribir el mismo código en las dos variables no lo duplica.
  const repetido = leerConfig({ ...env, CODIGOS_LIBRES: "codigo-viejo-de-siempre" });
  assert.ok(repetido.ok);
  assert.deepEqual(repetido.config.codigos, ["codigo-viejo-de-siempre"]);

  // Un código corto sigue siendo un error aunque venga por la lista corta.
  const corto = leerConfig({ SESSION_SECRET: secret, ACCESS_CODES: "codigo-largo-ok", CODIGOS_LIBRES: "abc" });
  assert.equal(corto.ok, false);
});

test("los tres niveles: quien juega, quien entra sin jugar y el dueño", async () => {
  // El reparto real del sitio: una clave para mirar la serie sin pasar por el
  // juego, y otra, la del dueño, que además llega a /estado y /subir.
  const env = {
    SESSION_SECRET: secret,
    ACCESS_CODES: "codigo-de-un-amigo",
    CODIGOS_LIBRES: "clave-para-mirar",
    CODIGOS_DUENO: "clave-del-dueno-del-sitio",
  };
  const leido = leerConfig(env);
  assert.ok(leido.ok);
  // Las tres entran, aunque dos no estén nombradas en ACCESS_CODES.
  assert.deepEqual(leido.config.codigos, [
    "codigo-de-un-amigo",
    "clave-para-mirar",
    "clave-del-dueno-del-sitio",
  ]);

  const nivel = async (codigo: string) => {
    const token = await crearSesion(codigo, leido.config);
    assert.ok(token, `${codigo} tiene que poder entrar`);
    const s = await verificarSesion(token, leido.config);
    assert.ok(s);
    return { libre: s.libre, dueno: s.dueno };
  };

  assert.deepEqual(await nivel("codigo-de-un-amigo"), { libre: false, dueno: false });
  assert.deepEqual(await nivel("clave-para-mirar"), { libre: true, dueno: false });
  // El dueño es libre además de dueño: no tiene que jugar para entrar.
  assert.deepEqual(await nivel("clave-del-dueno-del-sitio"), { libre: true, dueno: true });
});

test("sin CODIGOS_DUENO no hay dueño y nadie llega al mantenimiento", async () => {
  const leido = leerConfig({ SESSION_SECRET: secret, ACCESS_CODES: "codigo-de-octavio", CODIGOS_LIBRES: "codigo-de-octavio" });
  assert.ok(leido.ok);
  assert.deepEqual(leido.config.duenos, []);
  const token = await crearSesion("codigo-de-octavio", leido.config);
  const s = await verificarSesion(token, leido.config);
  assert.equal(s?.libre, true);
  assert.equal(s?.dueno, false, "ser libre no alcanza para entrar a /estado");
});

test("subir VERSION_ACCESO echa a todos los que ya estaban", async () => {
  const env = { SESSION_SECRET: secret, CODIGOS_DUENO: "clave-del-dueno-del-sitio" };
  const antes = leerConfig(env);
  const despues = leerConfig({ ...env, VERSION_ACCESO: "2" });
  assert.ok(antes.ok && despues.ok);
  assert.equal(antes.config.version, "1", "sin la variable, la versión es 1");

  // La sesión que había deja de valer, y la nueva no vale para atrás.
  const sesionVieja = await crearSesion("clave-del-dueno-del-sitio", antes.config);
  assert.ok(await verificarSesion(sesionVieja, antes.config));
  assert.equal(await verificarSesion(sesionVieja, despues.config), null, "la sesión vieja se cae");
  const sesionNueva = await crearSesion("clave-del-dueno-del-sitio", despues.config);
  assert.ok(await verificarSesion(sesionNueva, despues.config), "y con la versión nueva se entra igual");

  // Y el pase que alguien se ganó jugando, también: vuelve a jugar.
  const paseViejo = await crearPase("aBcD1234wXyZ", 93, antes.config);
  assert.ok(await verificarPase(paseViejo, antes.config));
  assert.equal(await verificarPase(paseViejo, despues.config), null, "el pase viejo se cae");

  // Un valor vacío no deja el sitio sin versión.
  const vacia = leerConfig({ ...env, VERSION_ACCESO: "  " });
  assert.ok(vacia.ok);
  assert.equal(vacia.config.version, "1");
});
