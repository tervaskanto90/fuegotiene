"use client";

import Link from "next/link";
import { codigo, episodios, tiempoTexto } from "@/lib/episodes";
import { proximoSinVer, useProgreso } from "@/lib/progress";

/**
 * Los capítulos donde aparece alguien del reparto, cada uno un enlace al
 * reproductor. Es de cliente sólo para marcar en menta los que ya se vieron
 * en este navegador (el progreso vive en localStorage); sin eso la lista es
 * la misma. Si ya se vio alguno y falta otro, abajo va el próximo que falta
 * en orden de emisión, con un botón que lleva directo (o sigue desde donde
 * quedó, si quedó a medias).
 */
export default function DondeAparece({ ids }: { ids: string[] }) {
  const { mapa, listo } = useProgreso();
  const caps = episodios.filter((e) => ids.includes(e.id));
  const vistos = listo ? caps.filter((e) => mapa[e.id]?.visto).length : 0;
  const proximo = listo && vistos > 0 ? proximoSinVer(caps.map((e) => e.id), mapa) : null;
  const ep = proximo ? caps.find((e) => e.id === proximo.id) : undefined;

  return (
    <div className="donde">
      <ul className="donde__caps">
        {caps.map((e) => {
          const visto = listo && mapa[e.id]?.visto;
          return (
            <li key={e.id}>
              <Link
                href={`/ver/${e.id}`}
                className={`donde__cap narrow${visto ? " donde__cap--visto" : ""}`}
                title={e.titulo}
                aria-label={`ver ${codigo(e)} ${e.titulo}${visto ? ", visto" : ""}`}
              >
                {codigo(e)}
              </Link>
            </li>
          );
        })}
      </ul>
      {vistos > 0 && (
        <p className="donde__vistos muted">
          {vistos === caps.length ? "Lo viste en todos." : `Viste ${vistos} de ${caps.length}.`}
          {ep && ` El próximo que te falta es el ${codigo(ep)}, ${ep.titulo}.`}
        </p>
      )}
      {ep && proximo && (
        <p className="donde__proximo">
          <Link
            className="boton boton--chico"
            href={`/ver/${ep.id}${proximo.desde !== null ? "?seguir=1" : ""}`}
          >
            {proximo.desde !== null
              ? `seguir el ${codigo(ep)} desde ${tiempoTexto(proximo.desde)}`
              : `ver el ${codigo(ep)}`}
          </Link>
        </p>
      )}
    </div>
  );
}
