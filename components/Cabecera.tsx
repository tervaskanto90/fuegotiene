import Link from "next/link";
import { sitio } from "@/lib/site";

type Props = { activa?: "capitulos" | "expediente" | "juego" | "origen" };

/**
 * Las secciones de lectura y de ver. /subir y /estado quedan fuera del menú a
 * propósito: los capítulos ya están cargados y son pantallas de mantenimiento.
 * Siguen existiendo y se llega escribiendo la dirección; el reproductor
 * también enlaza a /estado cuando un video falla.
 */
export default function Cabecera({ activa }: Props) {
  return (
    <header className="cabecera">
      <Link href="/" className="wordmark" aria-label={sitio.nombre}>
        {sitio.nombre.replace("?", "")}
        <span className="wordmark__signo">?</span>
      </Link>
      <nav className="nav" aria-label="secciones">
        <Link href="/" aria-current={activa === "capitulos" ? "page" : undefined}>
          capítulos
        </Link>
        <Link href="/expediente" aria-current={activa === "expediente" ? "page" : undefined}>
          el expediente
        </Link>
        <Link href="/juego" aria-current={activa === "juego" ? "page" : undefined}>
          el juego
        </Link>
        <Link href="/origen" aria-current={activa === "origen" ? "page" : undefined}>
          el origen
        </Link>
        <span className="nav__corte" aria-hidden="true" />
        <form method="post" action="/api/salir">
          <button className="enlace" type="submit">
            salir
          </button>
        </form>
      </nav>
    </header>
  );
}
