import Link from "next/link";
import { sitio } from "@/lib/site";

type Props = { activa?: "capitulos" | "estado" };

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
        <Link href="/estado" aria-current={activa === "estado" ? "page" : undefined}>
          estado
        </Link>
        <form method="post" action="/api/salir">
          <button className="enlace" type="submit">
            salir
          </button>
        </form>
      </nav>
    </header>
  );
}
