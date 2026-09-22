"use client";

import { useState } from "react";
import { simuladores } from "@/lib/serie";

/** Las cuatro fichas del equipo: se elige una y se abre el legajo abajo. */
export default function Fichas() {
  const [abierta, setAbierta] = useState<string | null>(simuladores[0].id);
  const ficha = simuladores.find((f) => f.id === abierta) ?? null;

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
              onClick={() => setAbierta(activa ? null : f.id)}
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
        <article className="legajo" id="legajo" key={ficha.id}>
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
