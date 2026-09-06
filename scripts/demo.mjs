// Regenera public/demo/muestra.mp4: 20 segundos, cronómetro, un tic por
// segundo, H.264 + AAC con +faststart. Es lo que se ve sin R2 configurado.
//
//   npm run demo
//
// Necesita ffmpeg (ver _ffmpeg.mjs) y una fuente TrueType: usa la variable
// FUENTE_TTF o, si no, la default de ffmpeg.

import { spawnSync } from "node:child_process";
import path from "node:path";
import { exigir } from "./_ffmpeg.mjs";

const { ffmpeg } = exigir();
const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const salida = path.join(raiz, "public", "demo", "muestra.mp4");
const fuente = process.env.FUENTE_TTF ? `fontfile=${process.env.FUENTE_TTF.replace(/\\/g, "/").replace(/:/g, "\\:")}:` : "";

const filtro = [
  "[0:v]drawbox=x=0:y=340:w='iw*t/20':h=20:color=0x7fb09c@1:t=fill",
  `drawtext=${fuente}text='%{pts\\:hms}':fontcolor=0xe8e2d4:fontsize=96:x=(w-text_w)/2:y=(h-text_h)/2-20`,
  `drawtext=${fuente}text='fuego tiene? clip de prueba, 20 segundos':fontcolor=0x8aa0a5:fontsize=22:x=(w-text_w)/2:y=h-70[v]`,
].join(",");

const r = spawnSync(
  ffmpeg,
  [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", "color=c=0x0d1f26:s=640x360:r=25:d=20",
    "-f", "lavfi", "-i", "sine=frequency=440:beep_factor=4:sample_rate=48000:d=20",
    "-filter_complex", filtro,
    "-map", "[v]", "-map", "1:a",
    "-c:v", "libx264", "-preset", "veryslow", "-crf", "30", "-pix_fmt", "yuv420p", "-profile:v", "main", "-level", "3.1",
    "-c:a", "aac", "-b:a", "48k", "-af", "volume=0.25",
    "-movflags", "+faststart", "-t", "20",
    salida,
  ],
  { stdio: "inherit" },
);
if (r.status !== 0) process.exit(1);
console.log(`Listo: ${salida}`);
