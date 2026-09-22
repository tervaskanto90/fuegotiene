import type { Metadata } from "next";
import Cabecera from "@/components/Cabecera";
import Revelar from "@/components/Revelar";
import { origen } from "@/lib/origen";

export const metadata: Metadata = { title: "el origen" };

export default function PaginaOrigen() {
  return (
    <div className="contenedor">
      <Cabecera activa="origen" />
      <main>
        <section className="intro">
          <h1 className="intro__titulo">el origen</h1>
          <p className="apertura">{origen.apertura}</p>
          <dl className="tira">
            {origen.datos.map((d) => (
              <div key={d.clave}>
                <dt>{d.clave}</dt>
                <dd className="narrow">{d.valor}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="relato">
          {origen.capitulos.map((c, capitulo) => {
            // El acento ladrillo se usa una sola vez por pantalla: acá, en la
            // última frase. No sale de un :last-child porque cada capítulo va
            // envuelto en su propio contenedor y todos serían el último.
            const esUltimo = capitulo === origen.capitulos.length - 1;
            return (
              <Revelar key={c.numero}>
                <section className="relato__cap">
                  <header>
                    <span className="relato__num narrow">{c.numero}</span>
                    <h2>{c.titulo}</h2>
                  </header>
                  <div className="relato__texto">
                    {c.parrafos.map((p, i) => (
                      <p key={i} className={esUltimo && i === c.parrafos.length - 1 ? "relato__cierre" : undefined}>
                        {p}
                      </p>
                    ))}
                  </div>
                </section>
              </Revelar>
            );
          })}
        </div>
      </main>
    </div>
  );
}
