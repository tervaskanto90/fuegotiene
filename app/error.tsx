"use client";

import Link from "next/link";
import { useLayoutEffect } from "react";
import { sitio } from "@/lib/site";

// Si una pantalla se rompe (un error de JavaScript que nadie atajó), Next
// muestra su propio cartel en inglés, con el estilo de Next. Este lo
// reemplaza en el tono del sitio. Es un componente de cliente, así que no
// puede armar la Cabecera (que lee las cookies en el servidor): va el
// wordmark solo, que alcanza para saber dónde se está.
//
// Es de cliente y no puede exportar metadata, así que el título de la
// pestaña se pone a mano. Un <title> de React no sirve: Next deja antes el
// de la página que se rompió, y el navegador muestra el primero. Y no
// alcanza con ponerlo una vez: al entrar directo, el título de la página
// llega por streaming después y lo pisa; por eso se lo sostiene mientras la
// pantalla está. Al irse se devuelve, salvo que la página nueva ya haya
// puesto el suyo. Layout y no effect: la limpieza tiene que correr antes de
// que el observador vea el título de la página nueva.
//
// Los errores del video no pasan por acá: el reproductor los explica él,
// con el diagnóstico de /api/estado/[id].
export default function Rota({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useLayoutEffect(() => {
    const antes = document.title;
    const propio = `se rompió · ${sitio.nombre}`;
    const poner = () => {
      if (document.title !== propio) document.title = propio;
    };
    poner();
    const vigia = new MutationObserver(poner);
    vigia.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
    return () => {
      vigia.disconnect();
      if (document.title === propio) document.title = antes;
    };
  }, []);

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
