// Bajar y subir un archivo del bucket con la misma firma que usa el sitio.
// Lo usa el workflow de GitHub Actions que convierte capítulos; también
// sirve a mano si alguien tiene Node:
//
//   node scripts/r2.mjs bajar s02e05.mp4 ./entrada.mp4
//   node scripts/r2.mjs subir ./salida.mp4 s02e05.mp4
//
// Lee R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY y R2_BUCKET del
// entorno (o de .env.local si existe).

import { createWriteStream, existsSync, readFileSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { AwsClient } from "aws4fetch";

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const envLocal = path.join(raiz, ".env.local");
if (existsSync(envLocal)) {
  for (const linea of readFileSync(envLocal, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linea);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
  console.error("Faltan variables de R2: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.");
  process.exit(1);
}

const cliente = new AwsClient({
  accessKeyId: R2_ACCESS_KEY_ID.trim(),
  secretAccessKey: R2_SECRET_ACCESS_KEY.trim(),
  region: "auto",
  service: "s3",
});

function urlDe(key) {
  const url = new URL(`https://${R2_ACCOUNT_ID.trim()}.r2.cloudflarestorage.com`);
  url.pathname = "/" + [R2_BUCKET.trim(), ...key.split("/")].map(encodeURIComponent).join("/");
  return url.toString();
}

const mb = (n) => `${(n / 1024 / 1024).toFixed(0)} MB`;

async function bajar(key, destino) {
  const res = await cliente.fetch(urlDe(key));
  if (!res.ok || !res.body) throw new Error(`R2 respondió ${res.status} al bajar ${key}`);
  const total = Number(res.headers.get("content-length") ?? 0);
  console.log(`bajando ${key} (${mb(total)})…`);
  let leidos = 0;
  let ultimo = -1;
  const progreso = new TransformStream({
    transform(trozo, ctrl) {
      leidos += trozo.byteLength;
      const pct = total ? Math.floor((leidos / total) * 100) : 0;
      if (pct !== ultimo && pct % 10 === 0) {
        console.log(`  ${pct}%`);
        ultimo = pct;
      }
      ctrl.enqueue(trozo);
    },
  });
  await pipeline(Readable.fromWeb(res.body.pipeThrough(progreso)), createWriteStream(destino));
  console.log(`listo: ${destino} (${mb(statSync(destino).size)})`);
}

async function subir(origen, key) {
  const datos = await readFile(origen);
  const tipo = key.endsWith(".mp4") ? "video/mp4" : key.endsWith(".vtt") ? "text/vtt; charset=utf-8" : "application/octet-stream";
  console.log(`subiendo ${origen} (${mb(datos.length)}) como ${key}…`);
  const res = await cliente.fetch(urlDe(key), {
    method: "PUT",
    body: datos,
    headers: { "Content-Type": tipo },
  });
  if (!res.ok) throw new Error(`R2 respondió ${res.status} al subir ${key}: ${(await res.text()).slice(0, 300)}`);
  console.log("subido.");
}

async function existe(key) {
  const res = await cliente.fetch(urlDe(key), { method: "HEAD" });
  return res.ok;
}

async function borrar(key) {
  const res = await cliente.fetch(urlDe(key), { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw new Error(`R2 respondió ${res.status} al borrar ${key}`);
  console.log(`borrado: ${key}`);
}

const [, , orden, a, b] = process.argv;
try {
  if (orden === "bajar" && a && b) await bajar(a, b);
  else if (orden === "subir" && a && b) await subir(a, b);
  else if (orden === "existe" && a) {
    const hay = await existe(a);
    console.log(hay ? "existe" : "no existe");
    process.exit(hay ? 0 : 2);
  } else if (orden === "borrar" && a) {
    await borrar(a);
  } else {
    console.error("Uso: node scripts/r2.mjs bajar <key> <archivo> | subir <archivo> <key> | existe <key> | borrar <key>");
    process.exit(1);
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
