"use client";

import Link from "next/link";
import { codigo, episodios } from "@/lib/episodes";
import { useProgreso } from "@/lib/progress";

/**
 * Los capítulos donde aparece alguien del reparto, cada uno un enlace al
 * reproductor. Es de cliente sólo para marcar en menta los que ya se vieron
 * en este navegador (el progreso vive en localStorage); sin eso la lista es
 * la misma.
 */
export default function DondeAparece({ ids }: { ids: string[] }) {
  const { mapa, listo } = useProgreso();
  const caps = ids.map((id) => episodios.find((e) => e.id === id)).filter((e) => e !== undefined);
  const vistos = listo ? caps.filter((e) => mapa[e.id]?.visto).length : 0;

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
        </p>
      )}
    </div>
  );
}
