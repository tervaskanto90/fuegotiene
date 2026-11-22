"use client";

import { useEffect, useRef, useState } from "react";
import { simuladores } from "@/lib/serie";

/** Las cuatro fichas del equipo: se elige una y se abre el legajo abajo. */
export default function Fichas() {
  const [abierta, setAbierta] = useState<string | null>(simuladores[0].id);
  const ficha = simuladores.find((f) => f.id === abierta) ?? null;
  const legajo = useRef<HTMLElement>(null);
  // Sólo después de un toque: al cargar la página el primero ya está abierto y no hay que mover nada.
  const eligio = useRef(false);

  // En el teléfono las fichas van una abajo de la otra y el legajo queda fuera de la pantalla:
  // tocar "04" cambiaba algo que no se veía. Si la cabeza del legajo no entra en lo visible, se
  // la trae debajo de la cabecera fija. En la compu, con el legajo a la vista, no se mueve nada.
  useEffect(() => {
    if (!eligio.current || !legajo.current) return;
    eligio.current = false;
    const caja = legajo.current.getBoundingClientRect();
    const cabecera = document.querySelector(".cabecera")?.getBoundingClientRect().height ?? 0;
    const seVe = caja.top >= cabecera && caja.top + 120 <= window.innerHeight;
    if (seVe) return;
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: caja.top + window.scrollY - cabecera - 16, behavior: quieto ? "auto" : "smooth" });
  }, [abierta]);

  return (
    <>
      <div className="fichas">
        {simuladores.map((f, i) => {
          const activa = f.id === abierta;
          return (
            <button
              key={f.id}
              type="button"
              className={`ficha${activa ? " ficha--activa" : ""}`}
              style={{ "--i": i } as React.CSSProperties}
              aria-expanded={activa}
              aria-controls="legajo"
              onClick={() => {
                eligio.current = !activa;
                setAbierta(activa ? null : f.id);
              }}
            >
              <span className="ficha__num narrow">{f.numero}</span>
              <span className="ficha__nombre">{f.personaje}</span>
              <span className="ficha__rol">{f.rol}</span>
              <span className="ficha__actor">{f.actor}</span>
            </button>
          );
        })}
      </div>

      {ficha && (
        <article className="legajo" id="legajo" key={ficha.id} ref={legajo}>
          <header className="legajo__cabeza">
            <span className="legajo__num narrow">{ficha.numero}</span>
            <div>
              <h3 className="legajo__nombre">{ficha.personaje}</h3>
              <p className="legajo__rol">{ficha.rol}</p>
            </div>
          </header>
          <dl className="legajo__datos">
            {ficha.datos.map((d) => (
              <div key={d.clave}>
                <dt>{d.clave}</dt>
                <dd>{d.valor}</dd>
              </div>
            ))}
          </dl>
          <div className="legajo__texto">
            <h4>el personaje</h4>
            {ficha.delPersonaje.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            <h4>el actor</h4>
            {ficha.delActor.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </article>
      )}
    </>
  );
}
