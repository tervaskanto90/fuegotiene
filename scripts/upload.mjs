// Sube a R2 lo que haya en una carpeta (mp4, vtt, jpg) con multipart, y
// completa las duraciones en data/episodes.json si hay ffprobe. Uso:
//
//   npm run upload -- ./listos
//
// Necesita las cuatro variables de R2 en .env.local o en el entorno.
// Es la alternativa a Cyberduck para quien sí puede correr Node.

import { createReadStream, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { sondear, ubicarFfprobe } from "./_ffmpeg.mjs";

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

// .env.local a mano, sin dependencias
const envLocal = path.join(raiz, ".env.local");
if (existsSync(envLocal)) {
  for (const linea of readFileSync(envLocal, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linea);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
  console.error("Faltan variables de R2 (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET).");
  process.exit(1);
}

const carpeta = process.argv[2] ?? path.join(raiz, "listos");
if (!existsSync(carpeta)) {
  console.error(`No existe la carpeta ${carpeta}`);
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  // R2 rechaza los checksums que el SDK agrega por defecto desde 2025.
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

const TIPOS = { ".mp4": "video/mp4", ".vtt": "text/vtt; charset=utf-8", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png" };
const archivos = readdirSync(carpeta).filter((n) => path.extname(n).toLowerCase() in TIPOS).sort();
if (archivos.length === 0) {
  console.error(`No hay mp4, vtt ni imágenes en ${carpeta}`);
  process.exit(1);
}

const rutaEpisodios = path.join(raiz, "data", "episodes.json");
const episodios = JSON.parse(readFileSync(rutaEpisodios, "utf8"));
const ffprobe = ubicarFfprobe();

for (const nombre of archivos) {
  const ruta = path.join(carpeta, nombre);
  const tamano = statSync(ruta).size;

  try {
    const existente = await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: nombre }));
    if (existente.ContentLength === tamano) {
      console.log(`=  ${nombre} ya está en el bucket con el mismo tamaño, lo salto`);
      continue;
    }
  } catch {
    // no está: se sube
  }

  console.log(`↑  ${nombre} (${(tamano / 1024 / 1024).toFixed(0)} MB)`);
  const subida = new Upload({
    client: s3,
    params: { Bucket: R2_BUCKET, Key: nombre, Body: createReadStream(ruta), ContentType: TIPOS[path.extname(nombre).toLowerCase()] },
    partSize: 64 * 1024 * 1024,
    queueSize: 3,
  });
  let ultimo = -1;
  subida.on("httpUploadProgress", (p) => {
    const pct = Math.floor(((p.loaded ?? 0) / tamano) * 100);
    if (pct !== ultimo && pct % 10 === 0) {
      process.stdout.write(`   ${pct}%\r`);
      ultimo = pct;
    }
  });
  await subida.done();
  process.stdout.write("   100%\n");

  const ep = episodios.find((e) => e.key === nombre);
  if (ep && ffprobe && nombre.endsWith(".mp4")) {
    const d = Number(sondear(ffprobe, ruta).format?.duration ?? 0);
    if (d) ep.duracion = Math.round(d);
  }
}

writeFileSync(rutaEpisodios, JSON.stringify(episodios, null, 2) + "\n");
console.log("\nListo. Si cambió alguna duración, hacé commit de data/episodes.json.");
