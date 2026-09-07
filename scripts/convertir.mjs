// Convierte un video para que lo reproduzca el navegador: video H.264 de
// 8 bits (se copia si ya lo es), audio AAC (se copia si ya lo es), mp4 con
// +faststart. Uso:
//
//   node scripts/convertir.mjs entrada.mp4 salida.mp4
//
// Lo usa el workflow de GitHub Actions; también sirve a mano con ffmpeg.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { exigir, sondear } from "./_ffmpeg.mjs";

const [, , entrada, salida] = process.argv;
if (!entrada || !salida || !existsSync(entrada)) {
  console.error("Uso: node scripts/convertir.mjs <entrada> <salida.mp4>");
  process.exit(1);
}

const { ffmpeg, ffprobe } = exigir();
const info = sondear(ffprobe, entrada);
const video = info.streams.find((s) => s.codec_type === "video");
const audio = info.streams.find((s) => s.codec_type === "audio");
if (!video) {
  console.error("El archivo no tiene pista de video.");
  process.exit(1);
}

const videoOk =
  video.codec_name === "h264" &&
  !/10|12/.test(video.pix_fmt ?? "") &&
  /^(Constrained Baseline|Baseline|Main|High)$/.test(video.profile ?? "");
const audioOk = !!audio && audio.codec_name === "aac";

console.log(`video: ${video.codec_name} ${video.profile ?? ""} ${video.pix_fmt ?? ""} ${video.width}x${video.height} -> ${videoOk ? "se copia" : "se convierte a H.264"}`);
console.log(`audio: ${audio ? `${audio.codec_name} ${audio.channels ?? ""}ch` : "sin audio"} -> ${audio ? (audioOk ? "se copia" : "se convierte a AAC") : "nada"}`);

const args = ["-y", "-hide_banner", "-loglevel", "warning", "-stats", "-i", entrada, "-map", "0:v:0"];
if (audio) args.push("-map", "0:a:0");
if (videoOk) args.push("-c:v", "copy");
else args.push("-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.0");
if (audio) {
  if (audioOk) args.push("-c:a", "copy");
  else args.push("-c:a", "aac", "-b:a", "160k", "-ac", "2");
}
args.push("-sn", "-movflags", "+faststart", salida);

const r = spawnSync(ffmpeg, args, { stdio: "inherit" });
if (r.status !== 0) {
  console.error("ffmpeg falló.");
  process.exit(1);
}
const resultado = sondear(ffprobe, salida);
for (const s of resultado.streams) {
  console.log(`salida ${s.codec_type}: ${s.codec_name} ${s.profile ?? ""} ${s.pix_fmt ?? ""}`.trim());
}
console.log(`duración: ${Math.round(Number(resultado.format?.duration ?? 0))} s`);
