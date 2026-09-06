// Lee la estructura de un archivo de video con pedidos parciales (Range) y
// dice si un navegador lo va a poder reproducir. Reemplaza a ffprobe para
// quien no puede instalar nada: detecta los dos problemas clásicos (audio
// AC-3/DTS y el índice `moov` al final) y también contenedores que Chrome
// no abre (avi, mkv) y video que no decodifica (Xvid, H.264 de 10 bits).
//
// No depende de Node ni del navegador: recibe una función que devuelve bytes.

export type Lector = (inicio: number, fin: number) => Promise<Uint8Array>;
export type Soporte = "si" | "no" | "depende";
export type Contenedor = "mp4" | "avi" | "mkv" | "webm" | "desconocido";
export type Veredicto = "ok" | "sin-audio" | "arranque-lento" | "no-reproducible" | "desconocido";

export type Pista = {
  tipo: "video" | "audio";
  fourcc: string;
  codec: string;
  soporte: Soporte;
  detalle: string;
};

export type Analisis = {
  contenedor: Contenedor;
  /** true si el índice está antes de los datos (+faststart); null si no se pudo saber */
  moovPrimero: boolean | null;
  pistas: Pista[];
  duracion: number | null;
  veredicto: Veredicto;
  mensaje: string;
  /** cajas de primer nivel en orden, para depurar: ["ftyp","moov","mdat"] */
  cajas: string[];
  bytesLeidos: number;
};

const CABEZA = 64 * 1024;
const MAX_MOOV = 48 * 1024 * 1024;

const texto = (b: Uint8Array, o: number, n: number) => {
  let s = "";
  for (let i = 0; i < n; i++) s += String.fromCharCode(b[o + i]);
  return s;
};
const u16 = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1];
const u32 = (b: Uint8Array, o: number) => ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];
const u64 = (b: Uint8Array, o: number) => u32(b, o) * 2 ** 32 + u32(b, o + 4);

type Caja = { tipo: string; inicio: number; tamano: number; cabecera: number };

/** Lee una cabecera de caja en `o`; `limite` es el fin del contenedor. */
function cabecera(b: Uint8Array, o: number, limite: number): Caja | null {
  if (o + 8 > limite) return null;
  let tamano = u32(b, o);
  const tipo = texto(b, o + 4, 4);
  let cab = 8;
  if (tamano === 1) {
    if (o + 16 > limite) return null;
    tamano = u64(b, o + 8);
    cab = 16;
  } else if (tamano === 0) {
    tamano = limite - o;
  }
  if (tamano < cab) return null;
  return { tipo, inicio: o, tamano, cabecera: cab };
}

function* hijas(b: Uint8Array, padre: Caja): Generator<Caja> {
  const fin = Math.min(padre.inicio + padre.tamano, b.length);
  let o = padre.inicio + padre.cabecera;
  while (o + 8 <= fin) {
    const c = cabecera(b, o, fin);
    if (!c) return;
    yield c;
    o += c.tamano;
  }
}

function hija(b: Uint8Array, padre: Caja, tipo: string): Caja | null {
  for (const c of hijas(b, padre)) if (c.tipo === tipo) return c;
  return null;
}

function detectarContenedor(cabeza: Uint8Array): Contenedor {
  if (cabeza.length < 12) return "desconocido";
  const t4 = texto(cabeza, 4, 4);
  if (["ftyp", "moov", "mdat", "free", "skip", "wide", "pnot", "uuid", "styp"].includes(t4)) return "mp4";
  if (texto(cabeza, 0, 4) === "RIFF" && texto(cabeza, 8, 4) === "AVI ") return "avi";
  if (cabeza[0] === 0x1a && cabeza[1] === 0x45 && cabeza[2] === 0xdf && cabeza[3] === 0xa3) {
    const inicio = texto(cabeza, 0, Math.min(cabeza.length, 64));
    return inicio.includes("webm") ? "webm" : "mkv";
  }
  return "desconocido";
}

const PERFILES_H264: Record<number, string> = {
  66: "Baseline",
  77: "Main",
  88: "Extended",
  100: "High",
  110: "High 10",
  122: "High 4:2:2",
  244: "High 4:4:4",
};

function pistaVideo(b: Uint8Array, e: Caja): Pista {
  const fourcc = e.tipo;
  const fin = Math.min(e.inicio + e.tamano, b.length);
  const ancho = e.inicio + 36 <= fin ? u16(b, e.inicio + 32) : 0;
  const alto = e.inicio + 36 <= fin ? u16(b, e.inicio + 34) : 0;
  const medida = ancho && alto ? `${ancho}×${alto}` : "";
  const desde = e.inicio + 86;
  const conf = (tipo: string): Caja | null => {
    let o = desde;
    while (o + 8 <= fin) {
      const c = cabecera(b, o, fin);
      if (!c) return null;
      if (c.tipo === tipo) return c;
      o += c.tamano;
    }
    return null;
  };

  switch (fourcc) {
    case "avc1":
    case "avc3": {
      const avcC = conf("avcC");
      let perfil = 0;
      let bits: number | null = null;
      if (avcC) {
        const p = avcC.inicio + avcC.cabecera;
        perfil = b[p + 1];
        bits = bitsAvcC(b, p, avcC.inicio + avcC.tamano, perfil);
      }
      const nombre = PERFILES_H264[perfil] ?? (perfil ? `perfil ${perfil}` : "perfil desconocido");
      const soportado = [66, 77, 88, 100].includes(perfil) && (bits === null || bits === 8);
      let soporte: Soporte = soportado ? "si" : "no";
      if (!avcC) soporte = "depende";
      const detalle = [medida, nombre, bits ? `${bits} bits` : ""].filter(Boolean).join(", ");
      return { tipo: "video", fourcc, codec: "H.264", soporte, detalle };
    }
    case "hvc1":
    case "hev1": {
      const hvcC = conf("hvcC");
      let detalle = medida;
      if (hvcC) {
        const p = hvcC.inicio + hvcC.cabecera;
        const perfil = b[p + 1] & 0x1f;
        const bits = (b[p + 17] & 7) + 8;
        detalle = [medida, perfil === 1 ? "Main" : perfil === 2 ? "Main 10" : `perfil ${perfil}`, `${bits} bits`]
          .filter(Boolean)
          .join(", ");
      }
      return {
        tipo: "video",
        fourcc,
        codec: "HEVC (H.265)",
        soporte: "depende",
        detalle: `${detalle}. Chrome sólo lo reproduce si la placa de video lo decodifica`.trim(),
      };
    }
    case "av01":
      return { tipo: "video", fourcc, codec: "AV1", soporte: "si", detalle: medida };
    case "vp09":
    case "vp08":
      return { tipo: "video", fourcc, codec: fourcc === "vp09" ? "VP9" : "VP8", soporte: "si", detalle: medida };
    case "mp4v":
    case "xvid":
    case "XVID":
    case "DX50":
    case "DIVX":
    case "divx":
    case "FMP4":
    case "fmp4":
    case "DIV3":
    case "div3":
    case "3IV2":
      return { tipo: "video", fourcc, codec: "MPEG-4 parte 2 (DivX/Xvid)", soporte: "no", detalle: medida };
    case "s263":
    case "h263":
      return { tipo: "video", fourcc, codec: "H.263", soporte: "no", detalle: medida };
    case "mjpa":
    case "mjpb":
    case "jpeg":
      return { tipo: "video", fourcc, codec: "Motion JPEG", soporte: "no", detalle: medida };
    case "encv":
      return { tipo: "video", fourcc, codec: "video cifrado", soporte: "no", detalle: medida };
    default:
      return { tipo: "video", fourcc, codec: `códec ${fourcc.trim()}`, soporte: "depende", detalle: `${medida} no lo reconozco`.trim() };
  }
}

/** Profundidad de bits desde avcC. Para Baseline/Main/Extended/High siempre son 8. */
function bitsAvcC(b: Uint8Array, p: number, fin: number, perfil: number): number | null {
  if ([66, 77, 88, 100].includes(perfil)) return 8;
  try {
    let q = p + 5;
    const nSps = b[q++] & 0x1f;
    for (let i = 0; i < nSps && q + 2 <= fin; i++) q += 2 + u16(b, q);
    const nPps = b[q++];
    for (let i = 0; i < nPps && q + 2 <= fin; i++) q += 2 + u16(b, q);
    if (q + 3 <= fin) return (b[q + 1] & 7) + 8;
  } catch {
    // avcC recortado
  }
  if (perfil === 110) return 10;
  return null;
}

const NOMBRE_AOT: Record<number, string> = {
  1: "AAC Main",
  2: "AAC-LC",
  3: "AAC SSR",
  4: "AAC LTP",
  5: "HE-AAC",
  29: "HE-AAC v2",
  23: "AAC-LD",
  39: "AAC-ELD",
  42: "xHE-AAC",
};

function pistaAudio(b: Uint8Array, e: Caja): Pista {
  const fourcc = e.tipo;
  const fin = Math.min(e.inicio + e.tamano, b.length);
  const version = e.inicio + 18 <= fin ? u16(b, e.inicio + 16) : 0;
  const canales = e.inicio + 26 <= fin ? u16(b, e.inicio + 24) : 0;
  const muestreo = e.inicio + 34 <= fin ? u16(b, e.inicio + 32) : 0;
  const base = e.inicio + 36 + (version === 1 ? 16 : version === 2 ? 36 : 0);
  const medida = [canales ? `${canales} canales` : "", muestreo ? `${muestreo} Hz` : ""].filter(Boolean).join(", ");

  const hijaEntrada = (tipo: string): Caja | null => {
    let o = base;
    while (o + 8 <= fin) {
      const c = cabecera(b, o, fin);
      if (!c) return null;
      if (c.tipo === tipo) return c;
      o += c.tamano;
    }
    return null;
  };

  switch (fourcc) {
    case "mp4a": {
      const esds = hijaEntrada("esds");
      const d = esds ? leerEsds(b, esds.inicio + esds.cabecera, esds.inicio + esds.tamano) : null;
      if (!d) return { tipo: "audio", fourcc, codec: "AAC", soporte: "si", detalle: `${medida}, sin esds`.replace(/^, /, "") };
      switch (d.oti) {
        case 0x40: {
          const nombre = d.aot !== null ? NOMBRE_AOT[d.aot] ?? `MPEG-4 audio tipo ${d.aot}` : "AAC";
          const soporte: Soporte = d.aot === null || [1, 2, 3, 4, 5, 29].includes(d.aot) ? "si" : d.aot === 42 ? "no" : "depende";
          return { tipo: "audio", fourcc, codec: nombre, soporte, detalle: medida };
        }
        case 0x66:
        case 0x67:
        case 0x68:
          return { tipo: "audio", fourcc, codec: "AAC (MPEG-2)", soporte: "si", detalle: medida };
        case 0x69:
        case 0x6b:
          return { tipo: "audio", fourcc, codec: "MP3", soporte: "si", detalle: medida };
        case 0xa5:
          return { tipo: "audio", fourcc, codec: "AC-3 (Dolby Digital)", soporte: "no", detalle: medida };
        case 0xa6:
          return { tipo: "audio", fourcc, codec: "E-AC-3 (Dolby Digital Plus)", soporte: "no", detalle: medida };
        case 0xa9:
        case 0xaa:
        case 0xab:
        case 0xac:
          return { tipo: "audio", fourcc, codec: "DTS", soporte: "no", detalle: medida };
        case 0xad:
          return { tipo: "audio", fourcc, codec: "Opus", soporte: "si", detalle: medida };
        default:
          return { tipo: "audio", fourcc, codec: `mp4a tipo 0x${d.oti.toString(16)}`, soporte: "depende", detalle: medida };
      }
    }
    case "ac-3":
      return { tipo: "audio", fourcc, codec: "AC-3 (Dolby Digital)", soporte: "no", detalle: medida };
    case "ec-3":
      return { tipo: "audio", fourcc, codec: "E-AC-3 (Dolby Digital Plus)", soporte: "no", detalle: medida };
    case "dtsc":
    case "dtsh":
    case "dtsl":
    case "dtse":
    case "dtsx":
      return { tipo: "audio", fourcc, codec: "DTS", soporte: "no", detalle: medida };
    case "mlpa":
      return { tipo: "audio", fourcc, codec: "Dolby TrueHD", soporte: "no", detalle: medida };
    case "Opus":
      return { tipo: "audio", fourcc, codec: "Opus", soporte: "si", detalle: medida };
    case "fLaC":
      return { tipo: "audio", fourcc, codec: "FLAC", soporte: "si", detalle: medida };
    case "alac":
      return { tipo: "audio", fourcc, codec: "ALAC", soporte: "no", detalle: medida };
    case ".mp3":
    case "mp3 ":
      return { tipo: "audio", fourcc, codec: "MP3", soporte: "si", detalle: medida };
    case "sowt":
    case "twos":
    case "lpcm":
    case "raw ":
    case "in24":
    case "in32":
    case "fl32":
    case "fl64":
      return { tipo: "audio", fourcc, codec: "PCM sin comprimir", soporte: "depende", detalle: medida };
    case "samr":
    case "sawb":
      return { tipo: "audio", fourcc, codec: "AMR", soporte: "no", detalle: medida };
    case "enca":
      return { tipo: "audio", fourcc, codec: "audio cifrado", soporte: "no", detalle: medida };
    default:
      return { tipo: "audio", fourcc, codec: `códec ${fourcc.trim()}`, soporte: "depende", detalle: `${medida} no lo reconozco`.trim() };
  }
}

/** Descriptor ES de MPEG-4: devuelve objectTypeIndication y audioObjectType. */
function leerEsds(b: Uint8Array, o: number, fin: number): { oti: number; aot: number | null } | null {
  let p = o + 4; // version + flags
  const largo = () => {
    let n = 0;
    for (let i = 0; i < 4 && p < fin; i++) {
      const x = b[p++];
      n = (n << 7) | (x & 0x7f);
      if (!(x & 0x80)) break;
    }
    return n;
  };
  if (p >= fin) return null;
  if (b[p] === 0x03) {
    p++;
    largo();
    p += 2; // ES_ID
    if (p >= fin) return null;
    const flags = b[p++];
    if (flags & 0x80) p += 2;
    if (flags & 0x40) {
      const l = b[p++];
      p += l;
    }
    if (flags & 0x20) p += 2;
  }
  if (p >= fin || b[p] !== 0x04) return null;
  p++;
  const l4 = largo();
  const inicioDcd = p;
  if (p >= fin) return null;
  const oti = b[p];
  p += 13;
  let aot: number | null = null;
  if (p < fin && p < inicioDcd + l4 && b[p] === 0x05) {
    p++;
    const l5 = largo();
    if (l5 >= 1 && p < fin) {
      aot = b[p] >> 3;
      if (aot === 31 && p + 1 < fin) aot = 32 + (((b[p] & 7) << 3) | (b[p + 1] >> 5));
    }
  }
  return { oti, aot };
}

function leerMvhd(b: Uint8Array, c: Caja): number | null {
  const o = c.inicio + c.cabecera;
  const fin = c.inicio + c.tamano;
  const version = b[o];
  if (version === 1) {
    if (o + 32 > fin) return null;
    const escala = u32(b, o + 20);
    const dur = u64(b, o + 24);
    return escala ? dur / escala : null;
  }
  if (o + 20 > fin) return null;
  const escala = u32(b, o + 12);
  const dur = u32(b, o + 16);
  return escala ? dur / escala : null;
}

const MAX_ENTRADAS_STSD = 8;

/** Una pista puede traer varias descripciones de muestras (archivos concatenados): se leen todas. */
function analizarTrak(b: Uint8Array, trak: Caja): Pista[] {
  const mdia = hija(b, trak, "mdia");
  if (!mdia) return [];
  const hdlr = hija(b, mdia, "hdlr");
  const manejador = hdlr ? texto(b, hdlr.inicio + hdlr.cabecera + 8, 4) : "";
  if (manejador !== "vide" && manejador !== "soun") return [];
  const minf = hija(b, mdia, "minf");
  const stbl = minf ? hija(b, minf, "stbl") : null;
  const stsd = stbl ? hija(b, stbl, "stsd") : null;
  if (!stsd) return [];
  const fin = Math.min(stsd.inicio + stsd.tamano, b.length);
  const cuenta = stsd.inicio + stsd.cabecera + 8 <= fin ? u32(b, stsd.inicio + stsd.cabecera + 4) : 0;
  const pistas: Pista[] = [];
  let o = stsd.inicio + stsd.cabecera + 8;
  for (let i = 0; i < Math.min(cuenta, MAX_ENTRADAS_STSD) && o + 8 <= fin; i++) {
    const entrada = cabecera(b, o, fin);
    if (!entrada) break;
    const pista = manejador === "vide" ? pistaVideo(b, entrada) : pistaAudio(b, entrada);
    if (cuenta > 1) pista.detalle = `${pista.detalle ? pista.detalle + ", " : ""}descripción ${i + 1} de ${cuenta}`;
    pistas.push(pista);
    o += entrada.tamano;
  }
  return pistas;
}

/** Analiza una caja moov completa en memoria. */
export function analizarMoov(b: Uint8Array): { pistas: Pista[]; duracion: number | null } {
  const raiz = cabecera(b, 0, b.length);
  const pistas: Pista[] = [];
  let duracion: number | null = null;
  if (!raiz || raiz.tipo !== "moov") return { pistas, duracion };
  for (const c of hijas(b, raiz)) {
    if (c.tipo === "mvhd") duracion = leerMvhd(b, c);
    if (c.tipo === "trak") pistas.push(...analizarTrak(b, c));
  }
  return { pistas, duracion };
}

function veredictoDe(
  contenedor: Contenedor,
  moovPrimero: boolean | null,
  pistas: Pista[],
  moovEncontrado: boolean,
  problemaMoov: string | null = null,
): { veredicto: Veredicto; mensaje: string } {
  if (contenedor === "avi") {
    return { veredicto: "no-reproducible", mensaje: "Es un archivo .avi. Los navegadores no lo reproducen: hay que pasarlo a .mp4 (H.264 + AAC)." };
  }
  if (contenedor === "mkv") {
    return { veredicto: "no-reproducible", mensaje: "Es un archivo Matroska (.mkv). Los navegadores no lo abren: hay que remuxarlo a .mp4, sin recomprimir si el video ya es H.264." };
  }
  if (contenedor === "webm") {
    return { veredicto: "ok", mensaje: "Es un WebM. Chrome lo reproduce si viene con VP8/VP9 y Vorbis/Opus." };
  }
  if (contenedor === "desconocido") {
    return { veredicto: "desconocido", mensaje: "No reconozco el formato: no es mp4, avi ni mkv. ¿Es un video?" };
  }
  if (!moovEncontrado) {
    return { veredicto: "desconocido", mensaje: "Es un mp4 pero no encontré el índice (moov). Puede estar cortado o incompleto." };
  }
  if (problemaMoov) {
    return { veredicto: "desconocido", mensaje: problemaMoov };
  }

  const video = pistas.filter((p) => p.tipo === "video");
  const audio = pistas.filter((p) => p.tipo === "audio");
  const partes: string[] = [];

  if (video.length === 0) {
    return {
      veredicto: "desconocido",
      mensaje:
        pistas.length === 0
          ? "Encontré el índice pero no pude leer las pistas. El archivo puede estar cortado o tener un índice raro."
          : `El archivo no tiene pista de video, sólo audio (${audio.map((p) => p.codec).join(", ")}).`,
    };
  }

  const videoMalo = video.find((p) => p.soporte === "no");
  if (videoMalo) {
    return {
      veredicto: "no-reproducible",
      mensaje: `El video está en ${videoMalo.codec}${videoMalo.detalle ? ` (${videoMalo.detalle})` : ""} y el navegador no lo decodifica. Hay que convertir el video a H.264 de 8 bits.`,
    };
  }
  let veredicto: Veredicto = "ok";
  if (audio.length > 0 && audio.every((p) => p.soporte === "no")) {
    veredicto = "sin-audio";
    const nombres = [...new Set(audio.map((p) => p.codec))].join(" y ");
    partes.push(`Se va a ver pero no se va a escuchar: el audio es ${nombres} y Chrome no lo reproduce. Hay que convertir el audio a AAC.`);
  } else if (audio.length === 0) {
    partes.push("El archivo no tiene pista de audio.");
  } else if (audio.some((p) => p.soporte === "depende")) {
    partes.push(`El audio es ${audio.map((p) => p.codec).join(", ")}: puede que no suene en todos los navegadores.`);
  }

  if (moovPrimero === false) {
    if (veredicto === "ok") veredicto = "arranque-lento";
    partes.push(
      "El índice del video está al final del archivo: el navegador va a bajar el capítulo casi entero antes de mostrar el primer cuadro y saltar en la barra se va a trabar. Hace falta remuxar con +faststart.",
    );
  }

  if (video.some((p) => p.soporte === "depende")) {
    partes.push(`El video es ${video.map((p) => p.codec).join(", ")}: depende de la máquina que lo mire.`);
  }

  if (partes.length === 0) partes.push("Listo: el navegador lo puede reproducir sin convertir nada.");
  return { veredicto, mensaje: partes.join(" ") };
}

/** Punto de entrada: analiza un archivo remoto o local con pocas lecturas parciales. */
export async function analizar(leer: Lector, tamano: number): Promise<Analisis> {
  let bytes = 0;
  const cabeza = await leer(0, Math.min(tamano, CABEZA));
  bytes += cabeza.length;
  const contenedor = detectarContenedor(cabeza);
  const base: Analisis = {
    contenedor,
    moovPrimero: null,
    pistas: [],
    duracion: null,
    veredicto: "desconocido",
    mensaje: "",
    cajas: [],
    bytesLeidos: bytes,
  };
  if (contenedor !== "mp4") {
    return { ...base, ...veredictoDe(contenedor, null, [], false), bytesLeidos: bytes };
  }

  // Recorrido de cajas de primer nivel: sólo se leen cabeceras.
  const cajas: string[] = [];
  let moov: { inicio: number; tamano: number } | null = null;
  let mdatVisto = false;
  let mdatAntesDeMoov = false;
  let o = 0;
  while (o + 8 <= tamano && cajas.length < 64) {
    let trozo: Uint8Array;
    let desplaz: number;
    if (o + 16 <= cabeza.length) {
      trozo = cabeza;
      desplaz = o;
    } else {
      trozo = await leer(o, Math.min(tamano, o + 16));
      bytes += trozo.length;
      desplaz = 0;
    }
    const restante = tamano - o;
    const c = cabecera(trozo, desplaz, desplaz + Math.min(restante, trozo.length - desplaz));
    if (!c) break;
    // size==0 significa "hasta el final del archivo"
    const tam = u32(trozo, desplaz) === 0 ? restante : c.tamano;
    cajas.push(c.tipo);
    if (c.tipo === "moov" && !moov) {
      moov = { inicio: o, tamano: tam };
      mdatAntesDeMoov = mdatVisto;
    }
    if (c.tipo === "mdat") mdatVisto = true;
    if (moov && mdatVisto) break;
    o += tam;
  }

  let pistas: Pista[] = [];
  let duracion: number | null = null;
  let problemaMoov: string | null = null;
  if (moov) {
    let datos: Uint8Array | null = null;
    if (moov.inicio + moov.tamano <= cabeza.length) {
      datos = cabeza.subarray(moov.inicio, moov.inicio + moov.tamano);
    } else if (moov.tamano <= MAX_MOOV) {
      datos = await leer(moov.inicio, Math.min(tamano, moov.inicio + moov.tamano));
      bytes += datos.length;
    } else {
      problemaMoov = `El índice del archivo pesa ${Math.round(moov.tamano / 1024 / 1024)} MB y no lo puedo revisar desde acá. Es rarísimo para un capítulo: probá abrirlo igual.`;
    }
    if (datos) {
      if (datos.length < moov.tamano) {
        problemaMoov = "El índice del archivo está incompleto: el archivo parece cortado o la subida no terminó.";
      }
      const r = analizarMoov(datos);
      pistas = r.pistas;
      duracion = r.duracion;
    }
  }

  const moovPrimero = moov ? !mdatAntesDeMoov : null;
  const { veredicto, mensaje } = veredictoDe(contenedor, moovPrimero, pistas, moov !== null, problemaMoov);
  return { contenedor, moovPrimero, pistas, duracion, veredicto, mensaje, cajas, bytesLeidos: bytes };
}
