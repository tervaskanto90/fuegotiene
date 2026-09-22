import type { Metadata } from "next";
import Cabecera from "@/components/Cabecera";
import Fichas from "@/components/Expediente";
import Reparto from "@/components/Reparto";
import Revelar from "@/components/Revelar";
import { laSerie, metodo, szifron } from "@/lib/serie";

export const metadata: Metadata = { title: "el expediente" };

export default function PaginaExpediente() {
  return (
    <div className="contenedor">
      <Cabecera activa="expediente" />
      <main>
        <section className="intro">
          <h1 className="intro__titulo">el expediente</h1>
          {laSerie.texto.map((p, i) => (
            <p key={i} className="intro__texto">
              {p}
            </p>
          ))}
          <dl className="tira">
            {laSerie.datos.map((d) => (
              <div key={d.clave}>
                <dt>{d.clave}</dt>
                <dd className="narrow">{d.valor}</dd>
              </div>
            ))}
          </dl>
        </section>

        <Revelar>
          <section className="seccion">
            <h2 className="seccion__titulo seccion__titulo--linea">
              el equipo
              <span className="num">4 legajos</span>
            </h2>
            <Fichas />
          </section>
        </Revelar>

        <Revelar>
          <section className="seccion">
            <h2 className="seccion__titulo seccion__titulo--linea">
              el método
              <span className="num">cómo es un operativo</span>
            </h2>
            <ol className="metodo">
              {metodo.map((m) => (
                <li key={m.numero}>
                  <span className="metodo__num narrow">{m.numero}</span>
                  <div>
                    <h3>{m.titulo}</h3>
                    <p>{m.texto}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </Revelar>

        <Revelar>
          <Reparto />
        </Revelar>

        <Revelar>
          <section className="seccion">
            <h2 className="seccion__titulo seccion__titulo--linea">
              quién la hizo
              <span className="num">{szifron.nombre}</span>
            </h2>
            <div className="szifron">
              <div className="szifron__texto">
                {szifron.texto.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
                <dl className="tira">
                  {szifron.datos.map((d) => (
                    <div key={d.clave}>
                      <dt>{d.clave}</dt>
                      <dd className="narrow">{d.valor}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <ol className="hitos">
                {szifron.hitos.map((h) => (
                  <li key={h.anio}>
                    <span className="hitos__anio narrow">{h.anio}</span>
                    <span>{h.que}</span>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        </Revelar>
      </main>
    </div>
  );
}
