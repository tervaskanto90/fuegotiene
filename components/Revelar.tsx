"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Deja aparecer lo que envuelve cuando entra en pantalla. Si el navegador no
 * tiene IntersectionObserver, o si alguien pidió menos movimiento, se ve
 * directamente: nunca esconde contenido sin poder mostrarlo.
 */
export default function Revelar({ children }: { children: React.ReactNode }) {
  const caja = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = caja.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={caja} className={`revelar${visible ? " revelar--visible" : ""}`}>
      {children}
    </div>
  );
}
