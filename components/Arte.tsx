import type { Episodio } from "@/lib/episodes";

type Props = { ep: Episodio; grande?: boolean; children?: React.ReactNode };

/** La imagen del capítulo, o la trama diagonal con el número hasta que haya un cuadro real. */
export default function Arte({ ep, grande, children }: Props) {
  const numero = String(ep.numero).padStart(2, "0");
  if (ep.arte) {
    return (
      <div className={`arte${grande ? " arte--grande" : ""}`}>
        <img src={`/art/${ep.arte}`} alt="" loading="lazy" decoding="async" />
        {children}
      </div>
    );
  }
  return (
    <div className={`arte arte--plano${grande ? " arte--grande" : ""}`} aria-hidden="true">
      <span className="arte__temp">temporada {ep.temporada}</span>
      <span className="arte__num">{numero}</span>
      {children}
    </div>
  );
}
