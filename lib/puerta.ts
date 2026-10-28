// La puerta: para ver los capítulos hay que ganárselo en el juego.
//
// La idea es que nadie mire la serie sin haberse puesto en el lugar de Santos
// y armado un operativo que se sostenga. El puntaje lo calcula el servidor
// (`evaluarPlan`, determinista), así que la puerta no depende de nada que el
// navegador pueda decir de sí mismo.
//
// Lo que acredita haber pasado es un "pase": una cookie firmada con el mismo
// HMAC de la sesión y atada al id del código, así copiar la cookie a otra
// persona no sirve. Además queda anotado en `pases.json`, en el bucket al
// lado de `marcas.json`, para que la persona no tenga que volver a jugar si
// entra desde otro navegador. La cookie es la que lee el middleware, porque
// corre en Edge y no puede ir al bucket en cada pedido.
//
// Acá viven las reglas: cuánto hay que sacar y cómo se anota. La cookie
// firmada del pase está en `lib/auth.ts`, con la de la sesión, porque usan el
// mismo HMAC. Quien guarda el JSON es `lib/pases.ts`, que sí necesita Node.
// Este archivo no importa nada: se testea como cualquier función.

export const KEY_PASES = "pases.json";

/**
 * Cuánto hay que sacar, sobre 100, para que se abra la puerta.
 *
 * Con la calibración de hoy: un operativo completo y bien contado pasa de 75,
 * uno decente ronda 60 y uno corto o violento queda abajo de 40. 70 deja
 * afuera al que escribe cualquier cosa y adentro al que se tomó el trabajo.
 * Se puede mover con la variable PUNTAJE_PARA_ENTRAR sin tocar código.
 */
export function puntajeParaEntrar(env: Record<string, string | undefined> = process.env): number {
  const crudo = Number((env.PUNTAJE_PARA_ENTRAR ?? "").trim());
  if (!Number.isFinite(crudo) || crudo < 1 || crudo > 100) return 70;
  return Math.round(crudo);
}

export type Pase = {
  /** el mejor puntaje que sacó */
  puntaje: number;
  /** con qué caso lo consiguió */
  caso: string;
  /** cuándo (ms) */
  fecha: number;
};

export type Pases = Record<string, Pase>;

/**
 * Lo que necesita saber una pantalla. `puntaje` es null si entró sin jugar, y
 * `sesion` dice si hay un código detrás (la mayoría entra sin ninguno).
 */
export type EstadoPuerta = {
  paso: boolean;
  puntaje: number | null;
  minimo: number;
  dueno: boolean;
  sesion: boolean;
};

/** Deja sólo lo que tiene la forma esperada; lo demás se descarta en silencio. */
export function normalizarPases(crudo: unknown): Pases {
  const salida: Pases = {};
  if (!crudo || typeof crudo !== "object") return salida;
  for (const [id, valor] of Object.entries(crudo as Record<string, unknown>)) {
    if (!/^[A-Za-z0-9_-]{8,40}$/.test(id) || !valor || typeof valor !== "object") continue;
    const p = valor as Record<string, unknown>;
    const puntaje = typeof p.puntaje === "number" && Number.isFinite(p.puntaje) ? Math.round(p.puntaje) : NaN;
    if (Number.isNaN(puntaje) || puntaje < 0 || puntaje > 100) continue;
    const fecha = typeof p.fecha === "number" && Number.isFinite(p.fecha) && p.fecha > 0 ? Math.floor(p.fecha) : Date.now();
    const caso = typeof p.caso === "string" ? p.caso.slice(0, 40) : "";
    salida[id] = { puntaje, caso, fecha };
  }
  return salida;
}

/**
 * Cuántos pases se guardan. Desde que el sitio es público, cada visitante que
 * gana deja una línea, y el archivo se lee y reescribe entero: con un tope se
 * mantiene chico para siempre. Al llegar, se van los más viejos. Perder una
 * línea vieja no le saca la entrada a nadie: lo que vale es la cookie, y esto
 * es el registro de quiénes pasaron.
 */
export const MAX_PASES = 500;

/**
 * Anota el pase. Si ya había uno se queda el mejor puntaje: la puerta se
 * cruza una sola vez y después nadie la pierde por jugar de nuevo y salir peor.
 */
export function conPase(pases: Pases, id: string, pase: Pase): Pases {
  const previo = pases[id];
  if (previo && previo.puntaje >= pase.puntaje) return pases;
  const salida = { ...pases, [id]: pase };
  const ids = Object.keys(salida);
  if (ids.length <= MAX_PASES) return salida;
  const porFecha = ids.sort((a, b) => salida[a].fecha - salida[b].fecha);
  for (const viejo of porFecha.slice(0, ids.length - MAX_PASES)) {
    if (viejo !== id) delete salida[viejo];
  }
  return salida;
}

// --- qué pide cada ruta ---
//
// Lo que aplica el middleware, puesto acá para que se pueda testear sin
// levantar Next: el 25/10 el manifest y los íconos rebotaban a /juego porque
// no estaban en la lista, y nada lo avisó.

/**
 * Lo que ve alguien que entra por primera vez, sin código y sin haber jugado:
 * el juego, que es la puerta, y el origen, que cuenta por qué existe esto.
 * Más el login, para quien tiene un código.
 */
export const PUBLICAS: RegExp[] = [
  /^\/juego$/,
  /^\/origen$/,
  /^\/api\/simulacro$/,
  /^\/entrar$/,
  /^\/api\/entrar$/,
  /^\/api\/salir$/,
  /^\/demo\//,
  /^\/robots\.txt$/,
  // Lo que el teléfono pide para "agregar a la pantalla de inicio": el
  // manifest, sus íconos y el de Apple. Sin esto el pedido rebota a /juego
  // y el ícono queda en blanco.
  /^\/manifest\.webmanifest$/,
  /^\/iconos\//,
  /^\/apple-icon\.png$/,
  // La imagen de la tarjeta de compartir: la pide el servidor de WhatsApp o
  // Telegram, que no tiene pase ni lo va a tener.
  /^\/opengraph-image\.png$/,
];

/**
 * Las pantallas de mantenimiento, sólo para los códigos de CODIGOS_DUENO.
 * Ganar el juego abre los capítulos, no el bucket.
 *
 * `/api/estado/[id]` queda afuera de esta lista a propósito: es el
 * diagnóstico de un capítulo y el reproductor lo usa para explicar en
 * palabras por qué un video no anda, en la pantalla de cualquiera.
 */
export const SOLO_DUENO: RegExp[] = [/^\/subir$/, /^\/estado$/, /^\/api\/subir$/, /^\/api\/estado$/];

/** Lo que importa de la sesión para decidir; null si no hay código detrás. */
export type QuienLlega = { libre: boolean; dueno: boolean } | null;

export type Decision =
  | { tipo: "pasa" }
  | { tipo: "redirige"; a: "/" | "/juego" }
  /** Para las rutas de API: un 403 con el motivo en palabras. */
  | { tipo: "rechaza"; error: string };

/**
 * Qué hace la puerta con un pedido. `tienePase` se consulta sólo cuando hace
 * falta: verificar el pase es una firma más, y las rutas públicas y las del
 * dueño se resuelven sin mirarlo.
 */
export async function decidirPuerta(
  pathname: string,
  sesion: QuienLlega,
  tienePase: () => Promise<boolean> | boolean,
): Promise<Decision> {
  if (PUBLICAS.some((r) => r.test(pathname))) {
    if (pathname === "/entrar" && sesion) return { tipo: "redirige", a: "/" };
    return { tipo: "pasa" };
  }

  if (SOLO_DUENO.some((r) => r.test(pathname))) {
    if (sesion?.dueno) return { tipo: "pasa" };
    if (pathname.startsWith("/api/")) return { tipo: "rechaza", error: "Esa pantalla es del dueño del sitio." };
    return { tipo: "redirige", a: "/" };
  }

  // Todo lo demás —capítulos, reproductor, expediente— pide el juego ganado.
  // Los códigos de CODIGOS_LIBRES y CODIGOS_DUENO se lo saltean.
  if (sesion?.libre) return { tipo: "pasa" };
  if (await tienePase()) return { tipo: "pasa" };

  if (pathname.startsWith("/api/")) return { tipo: "rechaza", error: "Todavía no pasaste el juego." };
  return { tipo: "redirige", a: "/juego" };
}
