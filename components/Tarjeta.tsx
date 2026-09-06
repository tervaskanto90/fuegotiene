import Link from "next/link";
import Arte from "@/components/Arte";
import { codigo, duracionTexto, fechaCorta, type Episodio } from "@/lib/episodes";
import type { Progreso } from "@/lib/progress";

type Props = { ep: Episodio; progreso?: Progreso; indice?: number };

export default function Tarjeta({ ep, progreso, indice = 0 }: Props) {
  const duracion = ep.duracion || progreso?.d || 0;
  const porcentaje =
    progreso && !progreso.visto && duracion > 0 ? Math.min(100, Math.round((progreso.t / duracion) * 100)) : 0;
  const meta = [fechaCorta(ep.emision), duracionTexto(duracion)].filter(Boolean).join(" · ");

  return (
    <Link href={`/ver/${ep.id}`} className="tarjeta" style={{ "--i": indice } as React.CSSProperties}>
      <Arte ep={ep}>
        <span className="tarjeta__ver" aria-hidden="true">
          {progreso && !progreso.visto && porcentaje > 0 ? "seguir" : "ver"}
        </span>
        {progreso?.visto && <span className="visto">visto</span>}
        {porcentaje > 0 && (
          <span className="barra" aria-hidden="true">
            <span className="barra__lleno" style={{ width: `${porcentaje}%` }} />
          </span>
        )}
      </Arte>
      <div className="tarjeta__cuerpo">
        <div className="tarjeta__linea">
          <span className="num">{codigo(ep)}</span>
          {porcentaje > 0 && <span className="mint num">{porcentaje}%</span>}
        </div>
        <div className="tarjeta__titulo">{ep.titulo}</div>
        {meta && <div className="tarjeta__meta">{meta}</div>}
      </div>
    </Link>
  );
}
