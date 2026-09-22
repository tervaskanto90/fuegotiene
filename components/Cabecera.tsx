import Link from "next/link";
import { sitio } from "@/lib/site";
import { estadoPuerta } from "@/lib/pases";

type Props = { activa?: "capitulos" | "expediente" | "juego" | "origen" };

function Candado() {
  return (
    <svg className="candado" viewBox="0 0 12 14" aria-label="cerrado" role="img">
      <path d="M3 6V4a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x="1.5" y="6" width="9" height="7" rx="1.5" fill="currentColor" />
    </svg>
  );
}

/**
 * Las secciones. /subir y /estado quedan fuera del menú a propósito: son
 * mantenimiento y sólo entra el dueño, escribiendo la dirección.
 *
 * "capítulos" y "el expediente" llevan candado hasta que la persona gana el
 * juego. Los enlaces siguen vivos: quien los toca cae en /juego con la
 * explicación, que enseña la regla mejor que un enlace muerto.
 *
 * "salir" aparece sólo si hay una sesión que cerrar: la mayoría entra sin
 * ningún código.
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
          title={puerta.paso ? undefined : "se abren cuando ganás el juego"}
        >
          capítulos
          {!puerta.paso && <Candado />}
        </Link>
        <Link
          href="/expediente"
          aria-current={activa === "expediente" ? "page" : undefined}
          title={puerta.paso ? undefined : "se abre cuando ganás el juego"}
        >
          el expediente
          {!puerta.paso && <Candado />}
        </Link>
        <Link href="/juego" aria-current={activa === "juego" ? "page" : undefined}>
          el juego
        </Link>
        <Link href="/origen" aria-current={activa === "origen" ? "page" : undefined}>
          el origen
        </Link>
        {puerta.sesion && (
          <>
            <span className="nav__corte" aria-hidden="true" />
            <form method="post" action="/api/salir">
              <button className="enlace" type="submit">
                salir
              </button>
            </form>
          </>
        )}
      </nav>
    </header>
  );
}
