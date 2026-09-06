import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { analizar, type Lector } from "../lib/mp4.ts";

const fixtures = path.join(import.meta.dirname, "fixtures");

function lectorDe(nombre: string): { leer: Lector; tamano: number; pedidos: [number, number][] } {
  const datos = new Uint8Array(readFileSync(path.join(fixtures, nombre)));
  const pedidos: [number, number][] = [];
  const leer: Lector = async (a, b) => {
    assert.ok(a >= 0 && b <= datos.length && a <= b, `rango fuera del archivo: ${a}-${b} de ${datos.length}`);
    pedidos.push([a, b]);
    return datos.subarray(a, b);
  };
  return { leer, tamano: datos.length, pedidos };
}

test("mp4 con faststart, H.264 + AAC: listo", async () => {
  const f = lectorDe("ok-faststart.mp4");
  const r = await analizar(f.leer, f.tamano);
  assert.equal(r.contenedor, "mp4");
  assert.equal(r.moovPrimero, true);
  assert.equal(r.veredicto, "ok");
  assert.deepEqual(r.cajas.slice(0, 2), ["ftyp", "moov"]);
  const video = r.pistas.find((p) => p.tipo === "video");
  const audio = r.pistas.find((p) => p.tipo === "audio");
  assert.equal(video?.codec, "H.264");
  assert.equal(video?.soporte, "si");
  assert.match(video?.detalle ?? "", /160×90/);
  assert.equal(audio?.codec, "AAC-LC");
  assert.equal(audio?.soporte, "si");
  assert.ok(r.duracion && r.duracion > 1.5 && r.duracion < 2.5, `duración ${r.duracion}`);
});

test("moov al final: arranque lento, y hace falta leer la cola", async () => {
  const f = lectorDe("moov-al-final.mp4");
  const r = await analizar(f.leer, f.tamano);
  assert.equal(r.moovPrimero, false);
  assert.equal(r.veredicto, "arranque-lento");
  assert.match(r.mensaje, /faststart/);
  assert.ok(r.cajas.indexOf("mdat") < r.cajas.indexOf("moov"));
  assert.equal(r.pistas.length, 2, "aun con el moov al final se leen las pistas");
});

test("audio AC-3: se ve pero no se escucha", async () => {
  const f = lectorDe("audio-ac3.mp4");
  const r = await analizar(f.leer, f.tamano);
  assert.equal(r.veredicto, "sin-audio");
  const audio = r.pistas.find((p) => p.tipo === "audio");
  assert.equal(audio?.fourcc, "ac-3");
  assert.equal(audio?.soporte, "no");
  assert.match(r.mensaje, /AC-3/);
});

test("H.264 de 10 bits: no se reproduce", async () => {
  const f = lectorDe("video-10bit.mp4");
  const r = await analizar(f.leer, f.tamano);
  assert.equal(r.veredicto, "no-reproducible");
  const video = r.pistas.find((p) => p.tipo === "video");
  assert.equal(video?.soporte, "no");
  assert.match(video?.detalle ?? "", /High 10/);
  assert.match(video?.detalle ?? "", /10 bits/);
});

test("MPEG-4 parte 2 (Xvid) dentro de mp4: no se reproduce", async () => {
  const f = lectorDe("video-mpeg4part2.mp4");
  const r = await analizar(f.leer, f.tamano);
  assert.equal(r.veredicto, "no-reproducible");
  assert.equal(r.pistas.find((p) => p.tipo === "video")?.fourcc, "mp4v");
});

test("audio MP3 dentro de mp4: anda", async () => {
  const f = lectorDe("audio-mp3.mp4");
  const r = await analizar(f.leer, f.tamano);
  assert.equal(r.veredicto, "ok");
  assert.equal(r.pistas.find((p) => p.tipo === "audio")?.codec, "MP3");
});

test("sin pista de audio: anda, y lo dice", async () => {
  const f = lectorDe("sin-audio.mp4");
  const r = await analizar(f.leer, f.tamano);
  assert.equal(r.veredicto, "ok");
  assert.equal(r.pistas.filter((p) => p.tipo === "audio").length, 0);
  assert.match(r.mensaje, /no tiene pista de audio/);
});

test("avi: no se reproduce en navegadores", async () => {
  const f = lectorDe("xvid.avi");
  const r = await analizar(f.leer, f.tamano);
  assert.equal(r.contenedor, "avi");
  assert.equal(r.veredicto, "no-reproducible");
  assert.equal(f.pedidos.length, 1, "con la cabeza alcanza");
});

test("mkv: no se reproduce en navegadores", async () => {
  const f = lectorDe("matroska.mkv");
  const r = await analizar(f.leer, f.tamano);
  assert.equal(r.contenedor, "mkv");
  assert.equal(r.veredicto, "no-reproducible");
});

test("archivo que no es video", async () => {
  const datos = new TextEncoder().encode("hola, esto no es un video ni de casualidad, sólo texto largo".repeat(4));
  const r = await analizar(async (a, b) => datos.subarray(a, b), datos.length);
  assert.equal(r.contenedor, "desconocido");
  assert.equal(r.veredicto, "desconocido");
});

test("archivo grande simulado: sólo se leen cabeceras e índice", async () => {
  // Armamos un mp4 falso: ftyp, un mdat gigante (simulado) y el moov real de un fixture al final.
  const real = new Uint8Array(readFileSync(path.join(fixtures, "ok-faststart.mp4")));
  const ftypTam = ((real[0] << 24) | (real[1] << 16) | (real[2] << 8) | real[3]) >>> 0;
  const moovTam = ((real[ftypTam] << 24) | (real[ftypTam + 1] << 16) | (real[ftypTam + 2] << 8) | real[ftypTam + 3]) >>> 0;
  const ftyp = real.subarray(0, ftypTam);
  const moov = real.subarray(ftypTam, ftypTam + moovTam);
  const MDAT = 3 * 1024 * 1024 * 1024; // 3 GB simulados
  const mdatCab = new Uint8Array(16);
  // size=1 -> largesize de 64 bits
  mdatCab.set([0, 0, 0, 1, 0x6d, 0x64, 0x61, 0x74]);
  const grande = BigInt(MDAT);
  for (let i = 0; i < 8; i++) mdatCab[8 + i] = Number((grande >> BigInt(8 * (7 - i))) & 0xffn);
  const tamano = ftyp.length + MDAT + moov.length;
  const leidos: number[] = [];
  const leer: Lector = async (a, b) => {
    leidos.push(b - a);
    const salida = new Uint8Array(b - a);
    for (let i = a; i < b; i++) {
      if (i < ftyp.length) salida[i - a] = ftyp[i];
      else if (i < ftyp.length + 16) salida[i - a] = mdatCab[i - ftyp.length];
      else if (i >= ftyp.length + MDAT) salida[i - a] = moov[i - ftyp.length - MDAT];
      else salida[i - a] = 0;
    }
    return salida;
  };
  const r = await analizar(leer, tamano);
  assert.equal(r.moovPrimero, false);
  assert.equal(r.veredicto, "arranque-lento");
  assert.equal(r.pistas.length, 2);
  const total = leidos.reduce((s, n) => s + n, 0);
  assert.ok(total < 200 * 1024, `leyó ${total} bytes; tendría que ser poco más que el índice`);
});
