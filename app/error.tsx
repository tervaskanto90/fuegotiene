"use client";

import Link from "next/link";
import { sitio } from "@/lib/site";

// Si una pantalla se rompe (un error de JavaScript que nadie atajó), Next
// muestra su propio cartel en inglés, con el estilo de Next. Este lo
// reemplaza en el tono del sitio. Es un componente de cliente, así que no
// puede armar la Cabecera (que lee las cookies en el servidor): va el
// wordmark solo, que alcanza para saber dónde se está.
//
// Los errores del video no pasan por acá: el reproductor los explica él,
// con el diagnóstico de /api/estado/[id].
export default function Rota({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="entrar" role="alert">
      <Link href="/" className="wordmark" aria-label={sitio.nombre}>
        {sitio.nombre.replace("?", "")}
        <span className="wordmark__signo">?</span>
      </Link>
      <h1 className="destacado__titulo">Esta pantalla se rompió.</h1>
      <p className="muted" style={{ marginTop: 8 }}>
        Algo falló al dibujarla. Probá de nuevo; si sigue igual, volvé al inicio y entrá desde ahí.
        {error.digest ? ` Código ${error.digest}.` : ""}
      </p>
      <div className="destacado__acciones" style={{ marginTop: 20 }}>
        <button className="boton boton--acento" type="button" onClick={() => reset()}>
          probar de nuevo
        </button>
        <Link className="boton" href="/">
          ir al inicio
        </Link>
      </div>
    </main>
  );
}
