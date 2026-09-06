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

/** Las URLs firmadas duran lo suficiente para un capítulo con pausas largas. */
export const EXPIRA_URL_S = 8 * 60 * 60;

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
