// Captura un cuadro de un video remoto con ffmpeg, en el servidor.
//
// ffmpeg viene del paquete @ffmpeg-installer/ffmpeg (un binario estático que
// npm baja para la plataforma del build; en Vercel, linux-x64). Ese binario
// no resuelve nombres de dominio de forma confiable, así que no se le da la
// URL de R2: se levanta un servidor HTTP mínimo en 127.0.0.1 que reenvía los
// pedidos parciales (Range) firmados por Node, y ffmpeg lee de ahí. Sólo se
// bajan la cabecera del mp4 y unos MB alrededor del cuadro elegido.

import { spawn } from "node:child_process";
import { access, chmod, constants, copyFile } from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";

/** Devuelve la respuesta upstream para un Range dado (o sin Range). */
export type PedirRango = (rango: string | null, signal: AbortSignal) => Promise<Response>;

/** Segundo del capítulo del que sacar la portada: después de la intro si está marcada; si no, pasado el arranque. */
export function elegirMomento(duracion: number | null, intro?: [number, number]): number {
  const d = duracion && Number.isFinite(duracion) ? duracion : 0;
  let t = intro ? intro[1] + 20 : Math.min(300, Math.max(60, d * 0.12));
  if (d > 0 && t > d - 5) t = Math.max(0, d * 0.5);
  return Math.round(t * 10) / 10;
}

let ffmpegResuelto: string | null | undefined;

export async function ubicarFfmpeg(): Promise<string | null> {
  if (ffmpegResuelto !== undefined) return ffmpegResuelto;
  const candidatos: string[] = [];
  if (process.env.FFMPEG) candidatos.push(process.env.FFMPEG);
  try {
    // El paquete queda fuera del bundle (serverExternalPackages) y se resuelve en tiempo de ejecución.
    const mod = (typeof require === "function" ? require("@ffmpeg-installer/ffmpeg") : null) as { path?: string } | null;
    if (mod?.path) candidatos.push(mod.path);
  } catch {
    // sin paquete
  }
  for (const bin of candidatos) {
    try {
      await access(bin, constants.X_OK);
      ffmpegResuelto = bin;
      return bin;
    } catch {
      // Sin permiso de ejecución (pasa al empaquetar): se copia a la carpeta temporal.
      try {
        const copia = path.join(os.tmpdir(), "ffmpeg-fuego-tiene");
        try {
          await access(copia, constants.X_OK);
        } catch {
          await copyFile(bin, copia);
          await chmod(copia, 0o755);
        }
        ffmpegResuelto = copia;
        return copia;
      } catch {
        // siguiente candidato
      }
    }
  }
  ffmpegResuelto = null;
  return null;
}

export async function capturarCuadro(
  pedir: PedirRango,
  segundos: number,
  opciones: { ancho?: number; timeoutMs?: number } = {},
): Promise<Uint8Array> {
  const ffmpeg = await ubicarFfmpeg();
  if (!ffmpeg) throw new Error("No hay ffmpeg en el servidor para sacar el cuadro.");
  const ancho = opciones.ancho ?? 640;
  const timeoutMs = opciones.timeoutMs ?? 45_000;

  const servidor = http.createServer(async (req, res) => {
    const control = new AbortController();
    req.on("close", () => control.abort());
    try {
      const up = await pedir(req.headers.range ?? null, control.signal);
      const cabeceras: Record<string, string> = {
        "Accept-Ranges": "bytes",
        "Content-Type": up.headers.get("content-type") ?? "video/mp4",
      };
      for (const nombre of ["content-length", "content-range"]) {
        const valor = up.headers.get(nombre);
        if (valor) cabeceras[nombre] = valor;
      }
      res.writeHead(up.status, cabeceras);
      if (!up.body || req.method === "HEAD") {
        res.end();
        return;
      }
      Readable.fromWeb(up.body as unknown as WebReadableStream)
        .on("error", () => res.destroy())
        .pipe(res);
    } catch {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    }
  });
  await new Promise<void>((listo) => servidor.listen(0, "127.0.0.1", listo));
  const puerto = (servidor.address() as AddressInfo).port;

  try {
    return await new Promise<Uint8Array>((resolver, rechazar) => {
      const args = [
        "-hide_banner", "-loglevel", "error", "-nostdin",
        "-ss", String(segundos),
        "-i", `http://127.0.0.1:${puerto}/video.mp4`,
        "-frames:v", "1",
        "-vf", `scale=${ancho}:-2`,
        "-q:v", "4",
        "-f", "image2pipe", "-vcodec", "mjpeg", "pipe:1",
      ];
      const proceso = spawn(ffmpeg, args, { stdio: ["ignore", "pipe", "pipe"] });
      const trozos: Buffer[] = [];
      let errores = "";
      proceso.stdout.on("data", (d: Buffer) => trozos.push(d));
      proceso.stderr.on("data", (d: Buffer) => (errores += d.toString()));
      const reloj = setTimeout(() => {
        proceso.kill("SIGKILL");
        rechazar(new Error("ffmpeg tardó demasiado en sacar el cuadro."));
      }, timeoutMs);
      proceso.on("error", (e) => {
        clearTimeout(reloj);
        rechazar(new Error(`No pude ejecutar ffmpeg: ${e.message}`));
      });
      proceso.on("close", (codigo) => {
        clearTimeout(reloj);
        const salida = Buffer.concat(trozos);
        if (codigo === 0 && salida.length > 1000 && salida[0] === 0xff && salida[1] === 0xd8) {
          resolver(new Uint8Array(salida));
        } else {
          rechazar(new Error(`ffmpeg falló (${codigo}): ${errores.trim().slice(0, 300) || "sin detalle"}`));
        }
      });
    });
  } finally {
    servidor.close();
  }
}
