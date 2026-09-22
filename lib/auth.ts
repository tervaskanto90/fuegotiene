// Sesión firmada con HMAC-SHA256 usando Web Crypto.
// Tiene que andar en Edge (middleware) y en Node (routes): nada de node:crypto.
//
// La cookie no guarda el código de acceso, guarda un hash corto del código,
// la fecha de vencimiento y la firma. Al verificar se comprueba que el código
// siga existiendo en ACCESS_CODES: sacar un código de la variable desloguea
// a esa persona en el acto.

export const COOKIE_SESION = "ft_sesion";
export const DURACION_SESION_S = 180 * 24 * 60 * 60; // 180 días
export const MIN_SECRET = 32;
export const MIN_CODIGO = 8;

export type ConfigAuth = { secret: string; codigos: string[]; libres: string[]; duenos: string[] };
export type ResultadoConfig =
  | { ok: true; config: ConfigAuth }
  | { ok: false; problema: string };

/**
 * Tres niveles, de menos a más:
 * - un código común: tiene que ganarse los capítulos en el juego.
 * - `libre` (CODIGOS_LIBRES): ve los capítulos sin jugar, y nada más.
 * - `dueno` (CODIGOS_DUENO): además entra a /estado y /subir. Es libre también.
 */
export type Sesion = { id: string; vence: number; libre: boolean; dueno: boolean };

const enc = new TextEncoder();

export function parsearCodigos(valor: string | undefined): string[] {
  if (!valor) return [];
  const vistos = new Set<string>();
  for (const parte of valor.split(/[,;\n]/)) {
    const codigo = parte.trim();
    if (codigo) vistos.add(codigo);
  }
  return [...vistos];
}

/** Lee las variables de acceso y dice qué falta, en palabras. */
export function leerConfig(env: Record<string, string | undefined> = process.env): ResultadoConfig {
  const secret = (env.SESSION_SECRET ?? "").trim();
  if (!secret) {
    return { ok: false, problema: "Falta la variable SESSION_SECRET." };
  }
  if (secret.length < MIN_SECRET) {
    return {
      ok: false,
      problema: `SESSION_SECRET es muy corto: tiene ${secret.length} caracteres y necesita al menos ${MIN_SECRET}.`,
    };
  }
  // Cada nivel implica el de abajo: el dueño entra sin jugar, y todos los
  // códigos nombrados en cualquiera de las tres variables sirven para entrar.
  // Antes había que repetirlos en ACCESS_CODES y, si uno se olvidaba, el login
  // rechazaba una clave recién cargada sin decir por qué.
  const duenos = parsearCodigos(env.CODIGOS_DUENO);
  const libres = [...new Set([...parsearCodigos(env.CODIGOS_LIBRES), ...duenos])];
  const codigos = [...new Set([...parsearCodigos(env.ACCESS_CODES), ...libres])];
  if (codigos.length === 0) {
    return { ok: false, problema: "Falta la variable ACCESS_CODES: no hay ningún código de acceso cargado." };
  }
  const corto = codigos.find((c) => c.length < MIN_CODIGO);
  if (corto) {
    return {
      ok: false,
      problema: `Hay un código de acceso de ${corto.length} caracteres. Cada código necesita al menos ${MIN_CODIGO}.`,
    };
  }
  return { ok: true, config: { secret, codigos, libres, duenos } };
}

function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** HMAC-SHA256 en base64url. Lo usa la sesión y también el pase de `lib/puerta.ts`. */
export async function firmar(secret: string, datos: string): Promise<string> {
  const clave = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const firma = await crypto.subtle.sign("HMAC", clave, enc.encode(datos));
  return base64url(new Uint8Array(firma));
}

/** Identificador del código para la cookie: HMAC con el secreto, así la cookie no permite adivinar el código por fuerza bruta. */
async function idDeCodigo(codigo: string, secret: string): Promise<string> {
  return (await firmar(secret, `id:${codigo}`)).slice(0, 16);
}

/** Comparación en tiempo constante para strings del mismo largo. */
export function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Devuelve el valor de la cookie si el código es válido, o null. */
export async function crearSesion(
  codigo: string,
  config: ConfigAuth,
  ahoraMs: number = Date.now(),
): Promise<string | null> {
  let encontrado: string | null = null;
  // Se recorren todos para no revelar por tiempo cuál coincidió.
  for (const c of config.codigos) {
    if (iguales(c, codigo)) encontrado = c;
  }
  if (encontrado === null) return null;
  const id = await idDeCodigo(encontrado, config.secret);
  const vence = Math.floor(ahoraMs / 1000) + DURACION_SESION_S;
  const cuerpo = `v1.${id}.${vence}`;
  return `${cuerpo}.${await firmar(config.secret, cuerpo)}`;
}

/** Verifica firma, vencimiento y que el código siga vigente. */
export async function verificarSesion(
  token: string | undefined | null,
  config: ConfigAuth,
  ahoraMs: number = Date.now(),
): Promise<Sesion | null> {
  if (!token) return null;
  const partes = token.split(".");
  if (partes.length !== 4 || partes[0] !== "v1") return null;
  const [, id, venceTexto, firma] = partes;
  if (!/^\d+$/.test(venceTexto)) return null;
  const vence = Number(venceTexto);
  if (!Number.isFinite(vence) || vence * 1000 < ahoraMs) return null;
  const esperada = await firmar(config.secret, `v1.${id}.${vence}`);
  if (!iguales(firma, esperada)) return null;
  for (const c of config.codigos) {
    if ((await idDeCodigo(c, config.secret)) === id) {
      return { id, vence, libre: config.libres.includes(c), dueno: config.duenos.includes(c) };
    }
  }
  return null;
}

// --- el pase del juego ---
//
// Para ver los capítulos hay que ganárselo en /juego. Lo que lo acredita es
// otra cookie firmada con el mismo secreto, atada al id del código: copiarla
// a la sesión de otra persona no sirve. Las reglas (cuánto hay que sacar,
// cómo se anota en el bucket) están en `lib/puerta.ts`.

export const COOKIE_PASE = "ft_pase";
export const DURACION_PASE_S = DURACION_SESION_S;

/** Valor de la cookie del pase. Va atado al id de la sesión. */
export async function crearPase(
  id: string,
  puntaje: number,
  config: ConfigAuth,
  ahoraMs: number = Date.now(),
): Promise<string> {
  const vence = Math.floor(ahoraMs / 1000) + DURACION_PASE_S;
  const cuerpo = `v1.${id}.${Math.round(puntaje)}.${vence}`;
  return `${cuerpo}.${await firmar(config.secret, `pase:${cuerpo}`)}`;
}

/**
 * Devuelve el puntaje con el que entró, o null. Pide el id de la sesión: un
 * pase ajeno, aunque esté bien firmado, no abre la puerta de otro.
 */
export async function verificarPase(
  token: string | undefined | null,
  id: string,
  config: ConfigAuth,
  ahoraMs: number = Date.now(),
): Promise<number | null> {
  if (!token) return null;
  const partes = token.split(".");
  if (partes.length !== 5 || partes[0] !== "v1") return null;
  const [, suId, puntajeTexto, venceTexto, firma] = partes;
  if (!/^\d+$/.test(puntajeTexto) || !/^\d+$/.test(venceTexto)) return null;
  if (!iguales(suId, id)) return null;
  const vence = Number(venceTexto);
  if (!Number.isFinite(vence) || vence * 1000 < ahoraMs) return null;
  const cuerpo = `v1.${suId}.${puntajeTexto}.${vence}`;
  const esperada = await firmar(config.secret, `pase:${cuerpo}`);
  if (!iguales(firma, esperada)) return null;
  return Number(puntajeTexto);
}

export function opcionesCookie(segura: boolean) {
  return {
    httpOnly: true,
    secure: segura,
    sameSite: "lax" as const,
    path: "/",
    maxAge: DURACION_SESION_S,
  };
}

/**
 * Sólo acepta rutas relativas internas para volver después de entrar.
 * Se canonicaliza con el parser de URL en vez de mirar los primeros
 * caracteres: "/\t/evil.com" parece interno pero el navegador le saca el
 * tab y lo manda a otro dominio.
 */
export function rutaSegura(valor: unknown): string {
  if (typeof valor !== "string" || !valor.startsWith("/")) return "/";
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(valor)) return "/";
  let url: URL;
  try {
    url = new URL(valor, "http://interno");
  } catch {
    return "/";
  }
  if (url.origin !== "http://interno" || url.username || url.password) return "/";
  if (url.pathname === "/api" || url.pathname.startsWith("/api/") || url.pathname.startsWith("/entrar")) return "/";
  return url.pathname + url.search;
}
