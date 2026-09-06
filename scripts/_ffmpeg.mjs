// Ubica ffmpeg y ffprobe sin dar por sentado que están instalados.
// Orden: variables FFMPEG / FFPROBE, paquetes @ffmpeg-installer y
// @ffprobe-installer si alguien los agregó con npm, y por último el PATH.

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function desdePaquete(nombre) {
  try {
    return require(nombre).path;
  } catch {
    return null;
  }
}

function anda(bin) {
  if (!bin) return false;
  const r = spawnSync(bin, ["-version"], { stdio: "ignore" });
  return r.status === 0;
}

export function ubicarFfmpeg() {
  const candidatos = [process.env.FFMPEG, desdePaquete("@ffmpeg-installer/ffmpeg"), "ffmpeg"];
  return candidatos.find(anda) ?? null;
}

export function ubicarFfprobe() {
  const candidatos = [process.env.FFPROBE, desdePaquete("@ffprobe-installer/ffprobe"), "ffprobe"];
  return candidatos.find(anda) ?? null;
}

export function exigir() {
  const ffmpeg = ubicarFfmpeg();
  const ffprobe = ubicarFfprobe();
  if (!ffmpeg || !ffprobe) {
    console.error(
      [
        "No encuentro ffmpeg y ffprobe.",
        "Opciones, de la más simple a la menos:",
        "  1. npm install -D @ffmpeg-installer/ffmpeg @ffprobe-installer/ffprobe   (los baja npm, sin instalar nada)",
        "  2. Bajar un ffmpeg portable y apuntar las variables FFMPEG y FFPROBE al .exe",
        "  3. Instalarlo en el sistema para que esté en el PATH",
      ].join("\n"),
    );
    process.exit(1);
  }
  return { ffmpeg, ffprobe };
}

/** Corre ffprobe y devuelve el JSON con streams y format. */
export function sondear(ffprobe, archivo) {
  const r = spawnSync(ffprobe, ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", archivo], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(`ffprobe falló con ${archivo}: ${r.stderr}`);
  return JSON.parse(r.stdout);
}
