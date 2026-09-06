"use client";

import { useState } from "react";
import type { Episodio } from "@/lib/episodes";

type Props = { ep: Episodio; grande?: boolean; foto?: string; children?: React.ReactNode };

/**
 * La imagen del capítulo. Debajo siempre está la trama con el número; si hay
 * un cuadro capturado (foto) o una imagen en public/art, aparece encima con
 * un fundido cuando termina de cargar.
 */
export default function Arte({ ep, grande, foto, children }: Props) {
  const numero = String(ep.numero).padStart(2, "0");
  const [cargada, setCargada] = useState(false);
  const [fallo, setFallo] = useState(false);
  const src = ep.arte ? `/art/${ep.arte}` : foto;
  return (
    <div className={`arte arte--plano${grande ? " arte--grande" : ""}`}>
      <span className="arte__temp" aria-hidden="true">
        temporada {ep.temporada}
      </span>
      <span className="arte__num" aria-hidden="true">
        {numero}
      </span>
      {src && !fallo && (
        <img
          className={`arte__foto${cargada ? " arte__foto--lista" : ""}`}
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setCargada(true)}
          onError={() => setFallo(true)}
        />
      )}
      {children}
    </div>
  );
}
