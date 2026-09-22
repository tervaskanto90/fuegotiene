// Sesión firmada con HMAC-SHA256 usando Web Crypto.
// Tiene que andar en Edge (middleware) y en Node (routes): nada de node:crypto.
//
// La cookie no guarda el código de acceso, guarda un hash corto del código,
// la fecha de vencimiento y la firma. Al verificar se comprueba que el código
// siga existiendo: sacar un código de la variable desloguea a esa persona en
// el acto.
//
// Entrar con código NO es obligatorio: al sitio se entra sin nada y el juego
// abre los capítulos. Los códigos sirven para saltearse el juego
// (CODIGOS_LIBRES) o para llegar al mantenimiento (CODIGOS_DUENO).

export const COOKIE_SESION = "ft_sesion";
export const DURACION_SESION_S = 180 * 24 * 60 * 60; // 180 días
export const MIN_SECRET = 32;
export const MIN_CODIGO = 8;

export type ConfigAuth = {
  secret: string;
  codigos: string[];
  libres: string[];
  duenos: string[];
  /** Ver VERSION_ACCESO más abajo. */
  version: string;
};
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
  // Subir este número invalida todas las cookies del sitio de una: las
  // sesiones y los pases ganados en el juego. Es la forma de echar a todos
  // los que entraron hasta hoy sin tener que cambiar SESSION_SECRET (que hay
  // que generar y guardar) ni borrar nada del bucket. Quien tiene código
  // vuelve a entrar en diez segundos; el resto juega de nuevo.
  const version = (env.VERSION_ACCESO ?? "1").trim() || "1";
  const duenos = parsearCodigos(env.CODIGOS_DUENO);
  const libres = [...new Set([...parsearCodigos(env.CODIGOS_LIBRES), ...duenos])];
  const codigos = [...new Set([...parsearCodigos(env.ACCESS_CODES), ...libres])];
  // Ya no hace falta ningún código para entrar al sitio: el juego es la puerta.
  // Los códigos son para saltearse el juego o para entrar al mantenimiento, y
  // un sitio sin ninguno anda perfecto.
  const corto = codigos.find((c) => c.length < MIN_CODIGO);
  if (corto) {
    return {
      ok: false,
      problema: `Hay un código de acceso de ${corto.length} caracteres. Cada código necesita al menos ${MIN_CODIGO}.`,
    };
  }
  return { ok: true, config: { secret, codigos, libres, duenos, version } };
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
  return `${cuerpo}.${await firmar(config.secret, `sesion:${config.version}:${cuerpo}`)}`;
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
  const esperada = await firmar(config.secret, `sesion:${config.version}:v1.${id}.${vence}`);
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
// otra cookie firmada con el mismo secreto. Lleva un id adentro: el de la
// sesión si la persona entró con código, o uno anónimo si no, que es el caso
// normal. El pase vale por sí mismo, sin necesidad de sesión: es lo que
// permite que alguien llegue al sitio sin nada, juegue y entre.
//
// Las reglas (cuánto hay que sacar, cómo se anota) están en `lib/puerta.ts`.

export const COOKIE_PASE = "ft_pase";
export const DURACION_PASE_S = DURACION_SESION_S;

/** Id para quien no entró con código. No identifica a nadie: sólo junta sus pases. */
export function idAnonimo(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return `a${base64url(bytes)}`;
}

/** Valor de la cookie del pase. */
export async function crearPase(
  id: string,
  puntaje: number,
  config: ConfigAuth,
  ahoraMs: number = Date.now(),
): Promise<string> {
  const vence = Math.floor(ahoraMs / 1000) + DURACION_PASE_S;
  const cuerpo = `v1.${id}.${Math.round(puntaje)}.${vence}`;
  return `${cuerpo}.${await firmar(config.secret, `pase:${config.version}:${cuerpo}`)}`;
}

export type Pase = { id: string; puntaje: number };

/**
 * Devuelve quién lo ganó y con cuánto, o null. No pide sesión: el pase vale
 * por sí mismo, que es lo que deja entrar a alguien que llegó al sitio sin
 * ningún código y se ganó los capítulos jugando.
 */
export async function verificarPase(
  token: string | undefined | null,
  config: ConfigAuth,
  ahoraMs: number = Date.now(),
): Promise<Pase | null> {
  if (!token) return null;
  const partes = token.split(".");
  if (partes.length !== 5 || partes[0] !== "v1") return null;
  const [, id, puntajeTexto, venceTexto, firma] = partes;
  if (!/^\d+$/.test(puntajeTexto) || !/^\d+$/.test(venceTexto)) return null;
  const vence = Number(venceTexto);
  if (!Number.isFinite(vence) || vence * 1000 < ahoraMs) return null;
  const cuerpo = `v1.${id}.${puntajeTexto}.${vence}`;
  const esperada = await firmar(config.secret, `pase:${config.version}:${cuerpo}`);
  if (!iguales(firma, esperada)) return null;
  return { id, puntaje: Number(puntajeTexto) };
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
