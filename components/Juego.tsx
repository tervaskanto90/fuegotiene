"use client";

import { useEffect, useRef, useState } from "react";
import { casos, contarPalabras, MAX_PLAN, type Resultado } from "@/lib/simulacro";

type Fase = "escribiendo" | "montando" | "resultado";

const MIENTRAS = [
  "Medina sale a averiguar quién es el otro…",
  "Lamponne consigue el lugar y los papeles…",
  "Ravenna se prueba el personaje…",
  "Santos reparte el guion…",
  "Se ejecuta el operativo…",
];

const COLOR: Record<Resultado["veredicto"], string> = {
  redondo: "ok",
  sale: "ok",
  raspando: "medio",
  "se-cae": "mal",
  vacio: "mal",
};

export default function Juego() {
  const [casoId, setCasoId] = useState(casos[0].id);
  const [planes, setPlanes] = useState<Record<string, string>>({});
  const [fase, setFase] = useState<Fase>("escribiendo");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paso, setPaso] = useState(0);
  const area = useRef<HTMLTextAreaElement>(null);

  const caso = casos.find((c) => c.id === casoId)!;
  const plan = planes[casoId] ?? "";
  const palabras = contarPalabras(plan);

  useEffect(() => {
    if (fase !== "montando") return;
    setPaso(0);
    const t = setInterval(() => setPaso((p) => (p + 1) % MIENTRAS.length), 1400);
    return () => clearInterval(t);
  }, [fase]);

  const poner = async () => {
    setFase("montando");
    setError(null);
    setResultado(null);
    try {
      const res = await fetch("/api/simulacro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ casoId, plan }),
      });
      if (res.status === 401) throw new Error("Tu sesión venció: entrá de nuevo y volvé a intentar.");
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? `El sitio respondió ${res.status}.`);
      setResultado(d as Resultado);
      setFase("resultado");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pude correr el simulacro.");
      setFase("escribiendo");
    }
  };

  const elegirCaso = (id: string) => {
    setCasoId(id);
    setFase("escribiendo");
    setResultado(null);
    setError(null);
  };

  return (
    <>
      <section className="intro">
        <h1 className="intro__titulo">el juego</h1>
        <p className="intro__texto">
          Ponete en el lugar de Santos. Llega un cliente con un problema que ya intentó resolver por las buenas,
          escribís el operativo y se simula cómo sale. No hay respuesta correcta: hay planes que se sostienen y planes
          que se caen a la mitad.
        </p>
      </section>

      <div className="casos" role="tablist" aria-label="casos">
        {casos.map((c, i) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={c.id === casoId}
            className={`caso-chip${c.id === casoId ? " caso-chip--activo" : ""}`}
            style={{ "--i": i } as React.CSSProperties}
            onClick={() => elegirCaso(c.id)}
          >
            {c.titulo}
          </button>
        ))}
      </div>

      <article className="carpeta" key={caso.id}>
        <header className="carpeta__cabeza">
          <span className="carpeta__etiqueta narrow">encargo</span>
          <h2>{caso.titulo}</h2>
        </header>
        <dl className="carpeta__datos">
          <div>
            <dt>cliente</dt>
            <dd>{caso.cliente}</dd>
          </div>
          <div>
            <dt>el problema</dt>
            <dd>{caso.problema}</dd>
          </div>
          <div>
            <dt>lo que hay que conseguir</dt>
            <dd>{caso.objetivo}</dd>
          </div>
          <div>
            <dt>lo que complica</dt>
            <dd>
              <ul className="carpeta__limites">
                {caso.limites.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </dd>
          </div>
        </dl>
      </article>

      {fase !== "resultado" && (
        <section className="plan">
          <label htmlFor="plan" className="plan__rotulo">
            tu operativo
          </label>
          <textarea
            id="plan"
            ref={area}
            className="plan__area"
            value={plan}
            maxLength={MAX_PLAN}
            disabled={fase === "montando"}
            placeholder="Quién averigua qué, por quién se hace pasar cada uno, qué hay que montar, en qué orden pasan las cosas y cómo se sale sin dejar rastro."
            onChange={(e) => setPlanes((p) => ({ ...p, [casoId]: e.target.value }))}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && fase === "escribiendo") poner();
            }}
            rows={10}
          />
          <div className="plan__pie">
            <span className="muted num">
              {palabras} {palabras === 1 ? "palabra" : "palabras"}
            </span>
            <span className="muted">
              con <kbd>ctrl</kbd> + <kbd>enter</kbd> también arranca
            </span>
            <span className="espacio" />
            <button className="boton boton--acento" type="button" onClick={poner} disabled={fase === "montando"}>
              {fase === "montando" ? "montando el operativo…" : "poner en marcha el operativo"}
            </button>
          </div>
          {error && <div className="aviso">{error}</div>}
        </section>
      )}

      {fase === "montando" && (
        <p className="montando" aria-live="polite">
          <span className="montando__punto" aria-hidden="true" />
          {MIENTRAS[paso]}
        </p>
      )}

      {fase === "resultado" && resultado && (
        <section className="desenlace" aria-live="polite">
          <header className={`desenlace__cabeza desenlace__cabeza--${COLOR[resultado.veredicto]}`}>
            <h2>{resultado.titulo}</h2>
            {resultado.veredicto !== "vacio" && (
              <div className="desenlace__puntaje">
                <span className="num">{resultado.puntaje}</span>
                <span className="muted">/100</span>
                <span className="desenlace__barra" aria-hidden="true">
                  <span style={{ width: `${resultado.puntaje}%` }} />
                </span>
              </div>
            )}
          </header>

          <ol className="desenlace__fases">
            {resultado.fases.map((f, i) => (
              <li key={i} style={{ "--i": i } as React.CSSProperties}>
                <h3>{f.titulo}</h3>
                <p>{f.texto}</p>
              </li>
            ))}
          </ol>

          <p className="desenlace__nota" style={{ "--i": resultado.fases.length } as React.CSSProperties}>
            {resultado.nota}
          </p>

          {(resultado.tuvo.length > 0 || resultado.falto.length > 0) && (
            <div className="balance" style={{ "--i": resultado.fases.length + 1 } as React.CSSProperties}>
              {resultado.tuvo.length > 0 && (
                <div>
                  <h4 className="mint">el plan tuvo</h4>
                  <ul>
                    {resultado.tuvo.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
              {resultado.falto.length > 0 && (
                <div>
                  <h4>le faltó</h4>
                  <ul>
                    {resultado.falto.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="desenlace__pie" style={{ "--i": resultado.fases.length + 2 } as React.CSSProperties}>
            <button
              className="boton"
              type="button"
              onClick={() => {
                setFase("escribiendo");
                setTimeout(() => area.current?.focus(), 60);
              }}
            >
              corregir el plan
            </button>
            <button
              className="boton"
              type="button"
              onClick={() => {
                const i = casos.findIndex((c) => c.id === casoId);
                elegirCaso(casos[(i + 1) % casos.length].id);
              }}
            >
              otro caso
            </button>
            <span className="espacio" />
            <span className="muted narrow">
              {resultado.porQuien === "claude" ? "narrado por Claude" : "simulador local"}
            </span>
          </div>
        </section>
      )}
    </>
  );
}
