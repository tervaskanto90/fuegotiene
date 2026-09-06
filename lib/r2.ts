// Cliente contra Cloudflare R2 usando aws4fetch: firma SigV4 con Web Crypto,
// sin dependencias, anda en Edge y en Node. La misma librería que usan los
// ejemplos de Cloudflare para R2.
//
// Si faltan las variables, el sitio entra en modo demo y sirve
// public/demo/muestra.mp4. No hay flag: aparecen las credenciales y se apaga.

import { AwsClient } from "aws4fetch";

export type ConfigR2 = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

/**
 * Las URLs firmadas duran tres horas: alcanza para un capítulo con pausas, y
 * si vence con la pestaña abierta el reproductor pide una firma nueva solo.
 * Más corto que eso no hace falta; más largo agranda la ventana en que una
 * URL copiada sigue sirviendo después de sacar un código.
 */
export const EXPIRA_URL_S = 3 * 60 * 60;

export function leerR2(env: Record<string, string | undefined> = process.env): ConfigR2 | null {
  const accountId = (env.R2_ACCOUNT_ID ?? "").trim();
  const accessKeyId = (env.R2_ACCESS_KEY_ID ?? "").trim();
  const secretAccessKey = (env.R2_SECRET_ACCESS_KEY ?? "").trim();
  const bucket = (env.R2_BUCKET ?? "").trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

/** Cuáles de las cuatro variables faltan, para mostrarlo en /estado. */
export function faltantesR2(env: Record<string, string | undefined> = process.env): string[] {
  return ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"].filter(
    (nombre) => !(env[nombre] ?? "").trim(),
  );
}

function cliente(config: ConfigR2): AwsClient {
  return new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    region: "auto",
    service: "s3",
    // aws4fetch reintenta 10 veces por defecto: con R2 caído eso supera el
    // tiempo máximo de la función y el error sale en inglés desde Vercel.
    retries: 2,
  });
}

/** URL del objeto, estilo path: https://<account>.r2.cloudflarestorage.com/<bucket>/<key> */
export function urlObjeto(config: ConfigR2, key: string): URL {
  const url = new URL(`https://${config.accountId}.r2.cloudflarestorage.com`);
  const segmentos = [config.bucket, ...key.split("/")].map(encodeURIComponent);
  url.pathname = "/" + segmentos.join("/");
  return url;
}

/** URL firmada para que el navegador pida los bytes directo a R2. */
export async function firmarUrl(
  config: ConfigR2,
  key: string,
  opciones: { metodo?: "GET" | "HEAD"; expiraS?: number } = {},
): Promise<string> {
  const url = urlObjeto(config, key);
  url.searchParams.set("X-Amz-Expires", String(opciones.expiraS ?? EXPIRA_URL_S));
  const firmada = await cliente(config).sign(new Request(url.toString(), { method: opciones.metodo ?? "GET" }), {
    aws: { signQuery: true },
  });
  return firmada.url;
}

/** Pedido firmado desde el servidor (HEAD, o GET con Range). No pasa por acá el video: sólo subtítulos y chequeos. */
export async function pedirR2(
  config: ConfigR2,
  key: string,
  init: { method?: "GET" | "HEAD"; headers?: Record<string, string> } = {},
): Promise<Response> {
  return cliente(config).fetch(urlObjeto(config, key).toString(), {
    method: init.method ?? "GET",
    headers: init.headers,
  });
}

export type ObjetoR2 = { key: string; tamano: number };
export type Listado = { objetos: ObjetoR2[]; truncado: boolean };

const ENTIDADES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };

function desentidar(s: string): string {
  return s
    .replace(/&(amp|lt|gt|quot|apos);/g, (m) => ENTIDADES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

/** Lee la respuesta XML de ListObjectsV2 sin parser: sólo Key, Size e IsTruncated. */
export function parsearListado(xml: string): Listado {
  const objetos: ObjetoR2[] = [];
  const re = /<Contents>([\s\S]*?)<\/Contents>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const key = /<Key>([\s\S]*?)<\/Key>/.exec(m[1])?.[1];
    const size = /<Size>(\d+)<\/Size>/.exec(m[1])?.[1];
    if (key !== undefined) objetos.push({ key: desentidar(key), tamano: Number(size ?? 0) });
  }
  const truncado = /<IsTruncated>true<\/IsTruncated>/.test(xml);
  return { objetos, truncado };
}

export type AccesoBucket =
  | { acceso: "ok"; listado: Listado }
  | { acceso: "credenciales" | "bucket" | "error"; mensaje: string };

/** Prueba el bucket con un listado corto y explica qué falla, si falla. */
export async function probarBucket(config: ConfigR2, maximo = 200): Promise<AccesoBucket> {
  const url = new URL(`https://${config.accountId}.r2.cloudflarestorage.com`);
  url.pathname = "/" + encodeURIComponent(config.bucket);
  url.searchParams.set("list-type", "2");
  url.searchParams.set("max-keys", String(maximo));
  let res: Response;
  try {
    res = await cliente(config).fetch(url.toString(), { method: "GET" });
  } catch (e) {
    void e;
    return {
      acceso: "error",
      mensaje: "No pude conectarme a R2. Revisá R2_ACCOUNT_ID: tiene que ser la tira de 32 caracteres, sin espacios. Si está bien, probá de nuevo en un rato.",
    };
  }
  if (res.status === 403) {
    return {
      acceso: "credenciales",
      mensaje: "R2 rechazó las credenciales (403). Revisá R2_ACCESS_KEY_ID y R2_SECRET_ACCESS_KEY, y que el token tenga permiso Object Read & Write sobre este bucket.",
    };
  }
  if (res.status === 404) {
    return {
      acceso: "bucket",
      mensaje: `R2 dice que el bucket "${config.bucket}" no existe en esa cuenta (404). Revisá R2_BUCKET y R2_ACCOUNT_ID.`,
    };
  }
  if (!res.ok) {
    return { acceso: "error", mensaje: `R2 respondió ${res.status} al listar el bucket.` };
  }
  return { acceso: "ok", listado: parsearListado(await res.text()) };
}
