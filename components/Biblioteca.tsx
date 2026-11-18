"use client";

import Link from "next/link";
import Arte from "@/components/Arte";
import Tarjeta from "@/components/Tarjeta";
import { codigo, duracionTexto, fechaCorta, quedaTexto, tiempoTexto, type Episodio } from "@/lib/episodes";
import type { Marcas } from "@/lib/marcas";
import { aMedias, ultimoEmpezado, useProgreso, type Progreso } from "@/lib/progress";
import { useEffect, useRef, useState } from "react";

type Props = { episodios: Episodio[] };

/** Cuántos a medias se muestran además del destacado: una fila, no otra grilla. */
const MAX_TAMBIEN = 4;

export default function Biblioteca({ episodios }: Props) {
  const { mapa, listo, marcar, reponer } = useProgreso();
  // El último que se marcó como visto desde el destacado, con cómo estaba
  // antes: alcanza para deshacerlo sin perder la posición.
  const [marcado, setMarcado] = useState<{ ep: Episodio; previo: Progreso | undefined } | null>(null);
  const deshacerRef = useRef<HTMLButtonElement>(null);
  const foco = useRef(false);

  // Al marcar, el botón que se tocó desaparece con el destacado viejo: el
  // foco pasa a "deshacer" para que el teclado no caiga al principio.
  useEffect(() => {
    if (marcado && foco.current) deshacerRef.current?.focus();
    foco.current = false;
  }, [marcado]);
  const [marcas, setMarcas] = useState<Marcas>({});
  const [marcasListas, setMarcasListas] = useState(false);

  // Anotaciones (versión de cada portada): una sola consulta, después de
  // montar. Las imágenes se piden recién con esto resuelto, para que la URL
  // no cambie a mitad de carga.
  useEffect(() => {
    let vivo = true;
    fetch("/api/marcas", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : {}))
      .then((m) => {
        if (vivo && m && typeof m === "object") setMarcas(m as Marcas);
      })
      .catch(() => {})
      .finally(() => {
        if (vivo) setMarcasListas(true);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const fotoDe = (id: string) => (marcasListas ? `/api/arte/${id}${marcas[id]?.arte ? `?v=${marcas[id].arte}` : ""}` : undefined);

  const temporadas = new Map<number, Episodio[]>();
  for (const e of episodios) {
    if (!temporadas.has(e.temporada)) temporadas.set(e.temporada, []);
    temporadas.get(e.temporada)!.push(e);
  }

  // Destacado: lo último que quedó a medias; si no hay, el primero sin ver.
  let destacado: { ep: Episodio; desde: number | null; duracion: number } | null = null;
  if (listo) {
    const ultimo = ultimoEmpezado(mapa);
    const ep = ultimo ? episodios.find((e) => e.id === ultimo.id) : undefined;
    if (ultimo && ep) {
      destacado = { ep, desde: ultimo.p.t, duracion: ep.duracion || ultimo.p.d };
    } else {
      const primero = episodios.find((e) => !mapa[e.id]?.visto);
      if (primero) destacado = { ep: primero, desde: null, duracion: primero.duracion || mapa[primero.id]?.d || 0 };
    }
  }

  const vistos = episodios.filter((e) => mapa[e.id]?.visto).length;

  // Los otros capítulos que quedaron a medias, además del destacado: el
  // destacado dice sólo el último, y quien dejó dos o tres empezados no los
  // tenía que buscar en la grilla.
  const otrosAMedias = listo
    ? aMedias(mapa)
        .map(({ id }) => episodios.find((e) => e.id === id))
        .filter((e): e is Episodio => !!e && e.id !== destacado?.ep.id)
    : [];
  const tambien = otrosAMedias.slice(0, MAX_TAMBIEN);

  return (
    <>
      <section className="seccion" style={{ marginTop: 0 }} aria-live="polite">
        {destacado ? (
          <div className="destacado">
            {/* La imagen lleva al mismo lugar que el botón principal: se toca con
                el mouse o el dedo, pero no es otra parada de Tab ni otro enlace
                para el lector de pantalla (el botón ya dice qué hace). */}
            <Link
              href={`/ver/${destacado.ep.id}${destacado.desde !== null ? "?seguir=1" : ""}`}
              tabIndex={-1}
              aria-hidden
            >
              <Arte
                ep={destacado.ep}
                grande
                foto={fotoDe(destacado.ep.id)}
              />
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
              {(() => {
                // Cuánto dura, o cuánto le queda si quedó a medias.
                const meta = [
                  destacado.ep.emision ? `emitido el ${fechaCorta(destacado.ep.emision)}` : "",
                  destacado.desde !== null
                    ? quedaTexto(destacado.desde, destacado.duracion)
                    : duracionTexto(destacado.duracion),
                ]
                  .filter(Boolean)
                  .join(" · ");
                return meta && <span className="muted">{meta}</span>;
              })()}
              <div
                className={`destacado__acciones${destacado.desde !== null ? " destacado__acciones--tres" : ""}`}
              >
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
                {/* Para el que quedó a medias a propósito o el que ya se vio en
                    otro lado: si no, el destacado queda trabado ahí. */}
                <button
                  type="button"
                  className="boton"
                  onClick={() => {
                    const ep = destacado!.ep;
                    foco.current = true;
                    setMarcado({ ep, previo: mapa[ep.id] });
                    marcar(ep.id);
                  }}
                >
                  marcar como visto
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="destacado destacado--vacio" aria-hidden={!listo || undefined}>
            {listo ? "Ya viste los 24. Elegí cualquiera para volver a verlo." : " "}
          </div>
        )}
        {marcado && (
          <p className="aviso-visto muted">
            <span>
              Anotaste el <span className="num">{codigo(marcado.ep)}</span> como visto.
            </span>
            <button
              type="button"
              ref={deshacerRef}
              className="boton boton--chico"
              onClick={() => {
                reponer(marcado.ep.id, marcado.previo);
                setMarcado(null);
              }}
            >
              deshacer
            </button>
          </p>
        )}
      </section>

      {tambien.length > 0 && (
        <section className="seccion" aria-labelledby="tambien-titulo">
          <h2 className="seccion__titulo seccion__titulo--linea" id="tambien-titulo">
            {tambien.length === 1 ? "también quedó a medias" : "también quedaron a medias"}
            <span className="num">
              {otrosAMedias.length > tambien.length
                ? `${tambien.length} de ${otrosAMedias.length}`
                : tambien.length}
            </span>
          </h2>
          <div className="grilla">
            {tambien.map((ep, i) => (
              <Tarjeta key={ep.id} ep={ep} progreso={mapa[ep.id]} indice={i} foto={fotoDe(ep.id)} />
            ))}
          </div>
        </section>
      )}

      {[...temporadas.entries()].map(([temporada, lista]) => (
        <section className="seccion" key={temporada}>
          <h2 className="seccion__titulo seccion__titulo--linea">
            temporada {temporada}
            <span className="num">
              {lista.length} capítulos
              {listo && (() => {
                const v = lista.filter((e) => mapa[e.id]?.visto).length;
                return v > 0 ? `, ${v} ${v === 1 ? "visto" : "vistos"}` : "";
              })()}
            </span>
          </h2>
          <div className="grilla">
            {lista.map((ep, i) => (
              <Tarjeta key={ep.id} ep={ep} progreso={mapa[ep.id]} indice={i} foto={fotoDe(ep.id)} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
