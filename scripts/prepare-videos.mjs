// Deja los capítulos listos para el navegador y los renombra como espera el
// sitio. Uso:
//
//   npm run prepare-videos -- "C:\ruta\a\los\capitulos"
//
// Para cada video de la carpeta:
//   - detecta temporada y número por el nombre (1x03, s01e03, T1 cap 3...)
//   - si el video ya es H.264 de 8 bits lo copia sin recomprimir; si no, lo
//     convierte a H.264
//   - si el audio no es AAC (AC-3, DTS, MP3...) lo pasa a AAC
//   - escribe el mp4 con +faststart en ./listos/sXXeYY.mp4
//   - saca un cuadro al 20% como imagen en public/art/sXXeYY.jpg y lo anota
//     en data/episodes.json (campo arte), y también la duración
//   - convierte un .srt con el mismo nombre a .vtt
//
// Sólo se corre en la compu que tiene los archivos. No hace falta para que el
// sitio funcione: si los archivos ya se reproducen tal cual, se suben directo.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { exigir, sondear } from "./_ffmpeg.mjs";

const carpeta = process.argv[2];
if (!carpeta || !existsSync(carpeta)) {
  console.error('Uso: npm run prepare-videos -- "<carpeta con los capítulos>"');
  process.exit(1);
}

const { ffmpeg, ffprobe } = exigir();
const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const salida = path.join(raiz, "listos");
const arte = path.join(raiz, "public", "art");
const rutaEpisodios = path.join(raiz, "data", "episodes.json");
mkdirSync(salida, { recursive: true });
mkdirSync(arte, { recursive: true });

const episodios = JSON.parse(readFileSync(rutaEpisodios, "utf8"));
const VIDEO = /\.(mp4|mkv|avi|m4v|mov|wmv|mpg|mpeg|ts)$/i;

/** Saca temporada y número del nombre del archivo. */
export function detectar(nombre) {
  const base = nombre.replace(/\.[^.]+$/, "");
  const patrones = [
    /s(\d{1,2})\s*e(\d{1,2})/i,
    /(\d{1,2})x(\d{1,2})/i,
    /temp(?:orada)?\s*(\d{1,2})\D+(?:cap(?:[ií]tulo)?|ep(?:isodio)?)?\s*(\d{1,2})/i,
    /t(\d{1,2})\s*(?:cap|c|e|ep)\s*(\d{1,2})/i,
  ];
  for (const p of patrones) {
    const m = p.exec(base);
    if (m) return { temporada: Number(m[1]), numero: Number(m[2]) };
  }
  // un solo número: se asume numeración corrida (1..24)
  const solo = /(?:^|\D)(\d{1,2})(?:\D|$)/.exec(base);
  if (solo) {
    const n = Number(solo[1]);
    if (n >= 1 && n <= 13) return { temporada: 1, numero: n };
    if (n >= 14 && n <= 24) return { temporada: 2, numero: n - 13 };
  }
  return null;
}

function hms(segundos) {
  const s = Math.floor(segundos);
  return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

const archivos = readdirSync(carpeta).filter((n) => VIDEO.test(n)).sort();
if (archivos.length === 0) {
  console.error(`No hay videos en ${carpeta}`);
  process.exit(1);
}

let cambios = 0;
for (const nombre of archivos) {
  const origen = path.join(carpeta, nombre);
  const d = detectar(nombre);
  if (!d) {
    console.log(`?  ${nombre}: no pude sacar temporada y número del nombre, lo salto`);
    continue;
  }
  const id = `s${String(d.temporada).padStart(2, "0")}e${String(d.numero).padStart(2, "0")}`;
  const ep = episodios.find((e) => e.id === id);
  if (!ep) {
    console.log(`?  ${nombre}: detecté ${id} pero no existe en episodes.json, lo salto`);
    continue;
  }

  const info = sondear(ffprobe, origen);
  const video = info.streams.find((s) => s.codec_type === "video");
  const audio = info.streams.find((s) => s.codec_type === "audio");
  const duracion = Number(info.format?.duration ?? 0);

  const videoOk = video && video.codec_name === "h264" && !/10/.test(video.pix_fmt ?? "") && (video.profile ?? "").match(/Baseline|Main|High$/);
  const audioOk = audio && audio.codec_name === "aac";

  const destino = path.join(salida, ep.key.endsWith(".mp4") ? ep.key : `${id}.mp4`);
  const args = ["-y", "-hide_banner", "-loglevel", "error", "-stats", "-i", origen, "-map", "0:v:0"];
  if (audio) args.push("-map", "0:a:0");
  args.push(...(videoOk ? ["-c:v", "copy"] : ["-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-profile:v", "high"]));
  if (audio) args.push(...(audioOk ? ["-c:a", "copy"] : ["-c:a", "aac", "-b:a", "160k", "-ac", "2"]));
  args.push("-movflags", "+faststart", "-sn", destino);

  console.log(
    `→  ${nombre} -> ${path.basename(destino)}  video: ${video?.codec_name ?? "?"} ${videoOk ? "(copia)" : "(convierte)"}  audio: ${audio?.codec_name ?? "sin"} ${audio ? (audioOk ? "(copia)" : "(a aac)") : ""}`,
  );
  const r = spawnSync(ffmpeg, args, { stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`   falló ffmpeg con ${nombre}`);
    continue;
  }

  // cuadro al 20% para la portada
  const imagen = path.join(arte, `${id}.jpg`);
  const seg = duracion ? Math.floor(duracion * 0.2) : 60;
  const f = spawnSync(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-ss", hms(seg), "-i", destino, "-frames:v", "1", "-vf", "scale=640:-2", "-q:v", "4", imagen], { stdio: "inherit" });
  if (f.status === 0) ep.arte = `${id}.jpg`;

  // subtítulos .srt con el mismo nombre
  const srt = origen.replace(/\.[^.]+$/, ".srt");
  if (existsSync(srt)) {
    const vtt = path.join(salida, `${id}.vtt`);
    const s = spawnSync(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-i", srt, vtt], { stdio: "inherit" });
    if (s.status === 0) ep.sub = `${id}.vtt`;
  }

  if (duracion) ep.duracion = Math.round(duracion);
  cambios++;
}

writeFileSync(rutaEpisodios, JSON.stringify(episodios, null, 2) + "\n");
console.log(`\nListo: ${cambios} capítulos en ${salida}. episodes.json actualizado (duración, arte, subtítulos).`);
console.log("Ahora subilos a R2 con Cyberduck (ver SUBIR-CON-CYBERDUCK.md) o con: npm run upload -- ./listos");
