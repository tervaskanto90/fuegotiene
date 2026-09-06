import Link from "next/link";
import Cabecera from "@/components/Cabecera";

export default function NoEncontrado() {
  return (
    <div className="contenedor">
      <Cabecera />
      <main>
        <h1 className="destacado__titulo">Esa página no existe.</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          Volvé a los capítulos y elegí uno de ahí.
        </p>
        <p style={{ marginTop: 20 }}>
          <Link className="boton" href="/">
            ir a los capítulos
          </Link>
        </p>
      </main>
    </div>
  );
}
