// El texto para compartir un resultado del juego: el caso y el puntaje, nunca
// el plan (el plan es lo que el otro tiene que pensar). No importa nada para
// poder testearse sola; la dirección la pone quien la llama.

/** Qué se comparte de un desenlace. `minimo` es el puntaje que abre la puerta. */
export function textoCompartir(caso: string, puntaje: number, minimo: number): string {
  const p = Math.max(0, Math.min(100, Math.round(puntaje)));
  const base = `Armé un operativo para «${caso}» y sacó ${p} sobre 100`;
  if (p >= minimo) return `${base}. Con ${minimo} se abren los capítulos de Los Simuladores. ¿Vos cuánto sacás?`;
  const falta = minimo - p;
  return `${base}: ${falta === 1 ? "me faltó uno" : `me faltaron ${falta}`} para abrir los capítulos de Los Simuladores. ¿Vos cuánto sacás?`;
}

/** Cómo salió el intento de compartir, para decirlo en pantalla. */
export type Compartido = "compartido" | "copiado" | "cancelado" | "fallo";

/**
 * Comparte con la hoja del sistema si el navegador la tiene (teléfonos, casi
 * siempre) y si no copia al portapapeles. Cerrar la hoja sin elegir nada no es
 * un error.
 */
export async function compartir(datos: { titulo: string; texto: string; url: string }): Promise<Compartido> {
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  if (nav?.share) {
    try {
      await nav.share({ title: datos.titulo, text: datos.texto, url: datos.url });
      return "compartido";
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return "cancelado";
      // Si la hoja no se pudo abrir, se prueba con el portapapeles.
    }
  }
  try {
    await nav!.clipboard.writeText(`${datos.texto} ${datos.url}`);
    return "copiado";
  } catch {
    return "fallo";
  }
}
