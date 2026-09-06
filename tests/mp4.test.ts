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

// --- cajas sintéticas para los casos raros ---

function u32be(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

function caja(tipo: string, ...partes: (number[] | Uint8Array)[]): Uint8Array {
  const cuerpo = partes.flatMap((p) => [...p]);
  return new Uint8Array([...u32be(8 + cuerpo.length), ...tipo.split("").map((c) => c.charCodeAt(0)), ...cuerpo]);
}

const ftyp = caja("ftyp", "isom".split("").map((c) => c.charCodeAt(0)), u32be(512), "isom".split("").map((c) => c.charCodeAt(0)));
const mvhd = caja("mvhd", u32be(0), u32be(0), u32be(0), u32be(1000), u32be(2000), u32be(0x00010000), [0, 0, 0, 0], new Uint8Array(70));

function trakVideo(fourccs: string[]): Uint8Array {
  const hdlr = caja("hdlr", u32be(0), u32be(0), "vide".split("").map((c) => c.charCodeAt(0)), new Uint8Array(12), [0]);
  const entradas = fourccs.map((f) => caja(f, new Uint8Array(6), [0, 1], new Uint8Array(16), [0, 160, 0, 90], new Uint8Array(50)));
  const stsd = caja("stsd", u32be(0), u32be(entradas.length), ...entradas);
  const stbl = caja("stbl", stsd);
  const minf = caja("minf", stbl);
  const mdia = caja("mdia", hdlr, minf);
  return caja("trak", mdia);
}

function archivo(...cajas: Uint8Array[]): Uint8Array {
  const total = cajas.reduce((s, c) => s + c.length, 0);
  const salida = new Uint8Array(total);
  let o = 0;
  for (const c of cajas) {
    salida.set(c, o);
    o += c.length;
  }
  return salida;
}

test("stsd con dos descripciones: manda la peor", async () => {
  const datos = archivo(ftyp, caja("moov", mvhd, trakVideo(["avc1", "mp4v"])), caja("mdat", new Uint8Array(16)));
  const r = await analizar(async (a, b) => datos.subarray(a, b), datos.length);
  assert.equal(r.pistas.length, 2);
  assert.match(r.pistas[1].detalle, /descripción 2 de 2/);
  assert.equal(r.veredicto, "no-reproducible");
  assert.match(r.mensaje, /MPEG-4 parte 2/);
});

test("moov sin pistas legibles: no se dice que está listo", async () => {
  const datos = archivo(ftyp, caja("moov", mvhd), caja("mdat", new Uint8Array(16)));
  const r = await analizar(async (a, b) => datos.subarray(a, b), datos.length);
  assert.equal(r.veredicto, "desconocido");
  assert.match(r.mensaje, /no pude leer las pistas/);
  assert.equal(r.duracion, 2);
});

test("moov gigante: se avisa en vez de leerlo", async () => {
  const GIGANTE = 200 * 1024 * 1024;
  const cabeceraMoov = new Uint8Array([...u32be(GIGANTE), ..."moov".split("").map((c) => c.charCodeAt(0))]);
  const mdatCab = caja("mdat");
  const tamano = ftyp.length + GIGANTE + mdatCab.length;
  const pedidos: number[] = [];
  const leer: Lector = async (a, b) => {
    pedidos.push(b - a);
    const salida = new Uint8Array(b - a);
    for (let i = a; i < b; i++) {
      if (i < ftyp.length) salida[i - a] = ftyp[i];
      else if (i < ftyp.length + 8) salida[i - a] = cabeceraMoov[i - ftyp.length];
      else if (i >= ftyp.length + GIGANTE) salida[i - a] = mdatCab[i - ftyp.length - GIGANTE];
    }
    return salida;
  };
  const r = await analizar(leer, tamano);
  assert.equal(r.veredicto, "desconocido");
  assert.match(r.mensaje, /200 MB/);
  assert.ok(pedidos.reduce((s, n) => s + n, 0) < 100 * 1024, "no intentó bajar el índice gigante");
});

test("moov cortado: se avisa que el archivo está incompleto", async () => {
  const completo = archivo(ftyp, caja("moov", mvhd, trakVideo(["avc1"])), caja("mdat", new Uint8Array(16)));
  const cortado = completo.subarray(0, completo.length - 40); // se pierde parte del moov y el mdat
  const r = await analizar(async (a, b) => cortado.subarray(a, b), cortado.length);
  assert.equal(r.veredicto, "desconocido");
  assert.match(r.mensaje, /incompleto|cortado/);
});
