"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { anotarMejor, guardarMejores, leerMejores, type Mejores } from "@/lib/mejores";
import type { EstadoPuerta } from "@/lib/puerta";
import { casos, contarPalabras, MAX_PLAN, type Resultado } from "@/lib/simulacro";

type Fase = "escribiendo" | "montando" | "resultado";

/** Lo que /api/simulacro agrega al resultado para contar cómo quedó la puerta. */
type Puerta = { minimo: number; puntaje: number; paso: boolean; recien: boolean };
type Respuesta = Resultado & { puerta?: Puerta };

type Props = { puerta: EstadoPuerta };

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

export default function Juego({ puerta }: Props) {
  const [casoId, setCasoId] = useState(casos[0].id);
  const [planes, setPlanes] = useState<Record<string, string>>({});
  const [fase, setFase] = useState<Fase>("escribiendo");
  const [resultado, setResultado] = useState<Respuesta | null>(null);
  // Arranca con lo que sabe el servidor y se actualiza sin recargar en cuanto
  // un operativo alcanza el puntaje.
  const [abierta, setAbierta] = useState(puerta.paso);
  const [error, setError] = useState<string | null>(null);
  const [paso, setPaso] = useState(0);
  // El mejor puntaje de cada caso en este navegador. Se lee después de montar
  // para que el HTML del servidor y el primer render del cliente coincidan.
  const [mejores, setMejores] = useState<Mejores>({});
  const area = useRef<HTMLTextAreaElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const pestanas = useRef<(HTMLButtonElement | null)[]>([]);
  const router = useRouter();

  const caso = casos.find((c) => c.id === casoId)!;
  const puntajeLogrado = resultado?.puerta?.paso ? resultado.puerta.puntaje : puerta.puntaje;
  const plan = planes[casoId] ?? "";
  const palabras = contarPalabras(plan);

  useEffect(() => {
    setMejores(leerMejores());
  }, []);

  useEffect(() => {
    if (fase !== "montando") return;
    setPaso(0);
    const t = setInterval(() => setPaso((p) => (p + 1) % MIENTRAS.length), 1400);
    return () => clearInterval(t);
  }, [fase]);

  // El área y el botón desaparecen al mandar el plan: sin esto el foco cae al
  // <body> y un lector de pantalla no se entera de que llegó el desenlace.
  useEffect(() => {
    if (fase === "resultado") titulo.current?.focus();
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
      const r = d as Respuesta;
      setResultado(r);
      if (r.veredicto !== "vacio") {
        // Se relee por si otra pestaña anotó algo mientras tanto.
        const antes = leerMejores();
        const despues = anotarMejor(antes, casoId, r.puntaje);
        if (despues !== antes) guardarMejores(despues);
        setMejores(despues);
      }
      if (r.puerta?.paso) {
        setAbierta(true);
        // La cabecera se arma en el servidor: sin esto el candado se queda
        // puesto hasta la próxima navegación, contradiciendo al cartel.
        if (r.puerta.recien) router.refresh();
      }
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

  // Los casos son pestañas: las flechas pasan de una a otra (dando la vuelta),
  // Inicio y Fin van a las puntas, y Tab sale de la lista en vez de recorrerla.
  const moverEntreCasos = (e: React.KeyboardEvent, i: number) => {
    const n = casos.length;
    const destino =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? (i + 1) % n
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? (i - 1 + n) % n
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? n - 1
              : null;
    if (destino === null) return;
    e.preventDefault();
    elegirCaso(casos[destino].id);
    pestanas.current[destino]?.focus();
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

      <aside className={`puerta${abierta ? " puerta--abierta" : ""}`}>
        <span className="puerta__rotulo narrow">{abierta ? "la puerta, abierta" : "la puerta"}</span>
        {abierta ? (
          <p>
            {puntajeLogrado === null
              ? "Entrás sin jugar: tu código está en la lista corta."
              : `Pasaste con ${puntajeLogrado}.`}{" "}
            Los capítulos y el expediente están de este lado. <a href="/">ver los capítulos</a>
          </p>
        ) : (
          <p>
            Los 24 capítulos y el expediente de los cuatro se abren cuando armás un operativo que salga bien:{" "}
            <b className="num">{puerta.minimo}</b> sobre 100 o más, en cualquiera de los seis casos. No hay contraseña
            ni hay que registrarse, y podés intentar las veces que quieras.
          </p>
        )}
      </aside>

      <div className="casos" role="tablist" aria-label="casos">
        {casos.map((c, i) => {
          const mejor = mejores[c.id];
          return (
            <button
              key={c.id}
              ref={(b) => {
                pestanas.current[i] = b;
              }}
              id={`caso-${c.id}`}
              type="button"
              role="tab"
              aria-selected={c.id === casoId}
              aria-controls="caso"
              tabIndex={c.id === casoId ? 0 : -1}
              onKeyDown={(e) => moverEntreCasos(e, i)}
              className={`caso-chip${c.id === casoId ? " caso-chip--activo" : ""}`}
              style={{ "--i": i } as React.CSSProperties}
              onClick={() => elegirCaso(c.id)}
            >
              {c.titulo}
              {mejor !== undefined && (
                <span className={`caso-chip__mejor num${mejor >= puerta.minimo ? " caso-chip__mejor--paso" : ""}`}>
                  <span className="solo-lector">, tu mejor puntaje: </span>
                  {mejor}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* div y no article: un article no puede ser tabpanel. */}
      <div className="carpeta" key={caso.id} id="caso" role="tabpanel" aria-labelledby={`caso-${caso.id}`}>
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
      </div>

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
            <h2 ref={titulo} tabIndex={-1}>
              {resultado.titulo}
            </h2>
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

          {resultado.puerta?.recien && (
            <div className="abrio" style={{ "--i": resultado.fases.length + 2 } as React.CSSProperties}>
              <p>
                <b>Se abrió la puerta.</b> Hacían falta {resultado.puerta.minimo} y el operativo sacó{" "}
                <span className="num">{resultado.puerta.puntaje}</span>. Los capítulos y el expediente ya están.
              </p>
              {/* <a> y no <Link>: el router ya se había prefetcheado /
                  sin pase y serviría ese rebote de su cache. Además una carga
                  entera refresca la cabecera y le saca el candado. */}
              <a className="boton boton--acento" href="/">
                ver los capítulos
              </a>
            </div>
          )}

          {resultado.puerta && !resultado.puerta.paso && resultado.veredicto !== "vacio" && (
            <p className="falta" style={{ "--i": resultado.fases.length + 2 } as React.CSSProperties}>
              Para abrir la puerta faltan{" "}
              <span className="num">{resultado.puerta.minimo - resultado.puerta.puntaje}</span>. Corregí el plan o
              probá con otro caso.
            </p>
          )}

          <div className="desenlace__pie" style={{ "--i": resultado.fases.length + 3 } as React.CSSProperties}>
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
            <span className="muted narrow">simulador local</span>
          </div>
        </section>
      )}
    </>
  );
}
