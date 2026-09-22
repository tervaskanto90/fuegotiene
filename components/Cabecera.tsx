import Link from "next/link";
import { sitio } from "@/lib/site";
import { estadoPuerta } from "@/lib/pases";

type Props = { activa?: "capitulos" | "expediente" | "juego" | "origen" };

/**
 * Las secciones de lectura y de ver. /subir y /estado quedan fuera del menú a
 * propósito: los capítulos ya están cargados y son pantallas de mantenimiento.
 * Siguen existiendo y se llega escribiendo la dirección; el reproductor
 * también enlaza a /estado cuando un video falla.
 *
 * "capítulos" lleva candado hasta que la persona pasa el juego. El enlace
 * sigue vivo: quien lo toca cae en /juego con la explicación, que enseña la
 * regla mejor que un enlace muerto.
 */
export default async function Cabecera({ activa }: Props) {
  const puerta = await estadoPuerta();
  return (
    <header className="cabecera">
      <Link href="/" className="wordmark" aria-label={sitio.nombre}>
        {sitio.nombre.replace("?", "")}
        <span className="wordmark__signo">?</span>
      </Link>
      <nav className="nav" aria-label="secciones">
        <Link
          href="/"
          aria-current={activa === "capitulos" ? "page" : undefined}
          title={puerta.paso ? undefined : "se abren cuando pasás el juego"}
        >
          capítulos
          {!puerta.paso && (
            <svg className="candado" viewBox="0 0 12 14" aria-label="cerrado" role="img">
              <path d="M3 6V4a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" strokeWidth="1.4" />
              <rect x="1.5" y="6" width="9" height="7" rx="1.5" fill="currentColor" />
            </svg>
          )}
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
