"use client";

import Link from "next/link";
import Arte from "@/components/Arte";
import Tarjeta from "@/components/Tarjeta";
import { codigo, fechaCorta, tiempoTexto, type Episodio } from "@/lib/episodes";
import { ultimoEmpezado, useProgreso } from "@/lib/progress";

type Props = { episodios: Episodio[] };

export default function Biblioteca({ episodios }: Props) {
  const { mapa, listo } = useProgreso();

  const temporadas = new Map<number, Episodio[]>();
  for (const e of episodios) {
    if (!temporadas.has(e.temporada)) temporadas.set(e.temporada, []);
    temporadas.get(e.temporada)!.push(e);
  }

  // Destacado: lo último que quedó a medias; si no hay, el primero sin ver.
  let destacado: { ep: Episodio; desde: number | null } | null = null;
  if (listo) {
    const ultimo = ultimoEmpezado(mapa);
    const ep = ultimo ? episodios.find((e) => e.id === ultimo.id) : undefined;
    if (ultimo && ep) {
      destacado = { ep, desde: ultimo.p.t };
    } else {
      const primero = episodios.find((e) => !mapa[e.id]?.visto);
      if (primero) destacado = { ep: primero, desde: null };
    }
  }

  const vistos = episodios.filter((e) => mapa[e.id]?.visto).length;

  return (
    <>
      <section className="seccion" style={{ marginTop: 0 }} aria-live="polite">
        {destacado ? (
          <div className="destacado">
            <Link href={`/ver/${destacado.ep.id}`} aria-label={`ver ${destacado.ep.titulo}`}>
              <Arte ep={destacado.ep} grande />
            </Link>
            <div className="destacado__info">
              <span className="muted">
                {destacado.desde !== null ? "quedó a medias" : vistos > 0 ? "el que sigue" : "para empezar"}
              </span>
              <h1 className="destacado__titulo">
                <span className="num muted" style={{ fontWeight: 400, marginRight: 10 }}>
                  {codigo(destacado.ep)}
                </span>
                {destacado.ep.titulo}
              </h1>
              {destacado.ep.emision && <span className="muted">emitido el {fechaCorta(destacado.ep.emision)}</span>}
              <div className="destacado__acciones">
                <Link
                  className="boton boton--acento"
                  href={`/ver/${destacado.ep.id}${destacado.desde !== null ? "?seguir=1" : ""}`}
                >
                  {destacado.desde !== null ? `seguir desde ${tiempoTexto(destacado.desde)}` : "ver el capítulo"}
                </Link>
                {destacado.desde !== null && (
                  <Link className="boton" href={`/ver/${destacado.ep.id}?desde=0`}>
                    empezar de nuevo
                  </Link>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="destacado destacado--vacio" aria-hidden="true">
            {listo ? "Ya viste los 24. Elegí cualquiera para volver a verlo." : " "}
          </div>
        )}
      </section>

      {[...temporadas.entries()].map(([temporada, lista]) => (
        <section className="seccion" key={temporada}>
          <h2 className="seccion__titulo">
            temporada {temporada}
            <span className="num">
              {lista.length} capítulos
              {listo && (() => {
                const v = lista.filter((e) => mapa[e.id]?.visto).length;
                return v > 0 ? `, ${v} vistos` : "";
              })()}
            </span>
          </h2>
          <div className="grilla">
            {lista.map((ep) => (
              <Tarjeta key={ep.id} ep={ep} progreso={mapa[ep.id]} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
