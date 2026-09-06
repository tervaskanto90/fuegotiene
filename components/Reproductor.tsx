"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { codigo, fechaCorta, tiempoTexto, type Episodio } from "@/lib/episodes";
import { enIntro, type Marca, type Marcas } from "@/lib/marcas";
import { reanudable, useProgreso } from "@/lib/progress";

type Props = { ep: Episodio; sig: Episodio | null; ant: Episodio | null };
type Fase = "cargando" | "elegir" | "viendo" | "terminado" | "error";

const CADA_MS = 5000;
const SEGUNDOS_PARA_SIGUIENTE = 12;
/** La portada se captura sola pasado este punto del capítulo (o al minuto, lo que llegue antes), si no hay una. */
const PORTADA_EN = 0.2;
const PORTADA_TOPE_S = 60;

function describirError(v: HTMLVideoElement): string {
  switch (v.error?.code) {
    case 1:
      return "La carga se interrumpió.";
    case 2:
      return "Se cortó la conexión mientras bajaba el video.";
    case 3:
      return "El navegador empezó a decodificar el video y falló a mitad de camino.";
    case 4:
      return "El navegador no puede reproducir este archivo.";
    default:
      return "El video no cargó.";
  }
}

export default function Reproductor({ ep, sig, ant }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const pantalla = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { mapa, listo, guardar, marcar } = useProgreso();

  const [fase, setFase] = useState<Fase>("cargando");
  const [error, setError] = useState<string | null>(null);
  const [diagnostico, setDiagnostico] = useState<string | null>(null);
  const [cuenta, setCuenta] = useState<number | null>(null);
  const [duracion, setDuracion] = useState(0);
  const [sinSesion, setSinSesion] = useState(false);

  // Anotaciones del capítulo: intro y portada, compartidas vía el bucket.
  const [marca, setMarca] = useState<Marca>({});
  const [marcasCargadas, setMarcasCargadas] = useState(false);
  const [mostrarSaltear, setMostrarSaltear] = useState(false);
  const [introInicio, setIntroInicio] = useState<number | null>(null);
  const [introFin, setIntroFin] = useState<number | null>(null);
  const [avisoAjustes, setAvisoAjustes] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // El video se pide en modo CORS para poder capturar cuadros. Si el bucket no
  // tiene la política CORS, la primera carga falla y se vuelve a pedir sin CORS.
  const [conCors, setConCors] = useState(true);
  const probadoSinCors = useRef(false);
  const capturaIntentada = useRef(false);

  /** true desde que la persona eligió ver: antes de eso no se guarda nada, para no pisar el progreso con 0. */
  const empezo = useRef(false);
  const ultimoReintento = useRef(0);
  const ultimoGuardado = useRef(0);
  const decidido = useRef(false);
  const guardadoInicial = useRef<number | null>(null);

  const guardarAhora = useCallback(() => {
    const v = video.current;
    if (!empezo.current || !v || !v.duration || Number.isNaN(v.duration)) return;
    guardar(ep.id, v.currentTime, v.duration);
    ultimoGuardado.current = Date.now();
  }, [ep.id, guardar]);

  // Anotaciones: una consulta al montar.
  useEffect(() => {
    let vivo = true;
    fetch("/api/marcas", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : {}))
      .then((m: Marcas) => {
        if (!vivo) return;
        const mia = m?.[ep.id] ?? {};
        setMarca(mia);
        setIntroInicio(mia.intro?.[0] ?? null);
        setIntroFin(mia.intro?.[1] ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (vivo) setMarcasCargadas(true);
      });
    return () => {
      vivo = false;
    };
  }, [ep.id]);

  // Cuando tenemos progreso y metadata, decidimos qué ofrecer.
  useEffect(() => {
    if (!listo || decidido.current) return;
    const p = mapa[ep.id];
    guardadoInicial.current = reanudable(p) ? p!.t : null;
    // Se lee de window y no de useSearchParams para que la página se pueda
    // prerenderizar entera, con el <video> incluido.
    const params = new URLSearchParams(window.location.search);
    const seguir = params.get("seguir") === "1";
    const desde = params.get("desde");
    const v = video.current;
    // Si el video ya está andando (play nativo antes de que React se enganche), no hay nada que preguntar.
    if (v && !v.paused && !v.ended) {
      decidido.current = true;
      empezo.current = true;
      setFase("viendo");
      return;
    }
    if (desde === "0") {
      decidido.current = true;
      setFase("viendo");
      return;
    }
    if (seguir && guardadoInicial.current !== null && v) {
      decidido.current = true;
      empezo.current = true;
      v.currentTime = guardadoInicial.current;
      setFase("viendo");
      v.play().catch(() => {});
      return;
    }
    decidido.current = true;
    setFase(guardadoInicial.current !== null ? "elegir" : "viendo");
  }, [listo, mapa, ep.id]);

  const seguirDesde = () => {
    const v = video.current;
    empezo.current = true;
    if (v && guardadoInicial.current !== null) v.currentTime = guardadoInicial.current;
    setFase("viendo");
    v?.play().catch(() => {});
  };

  const desdeCero = () => {
    const v = video.current;
    empezo.current = true;
    if (v) v.currentTime = 0;
    setFase("viendo");
    v?.play().catch(() => {});
  };

  /** Los controles nativos ponen en pantalla completa sólo el <video>, y ahí las capas no se ven. */
  const salirDePantallaCompletaNativa = () => {
    if (document.fullscreenElement && document.fullscreenElement !== pantalla.current) {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Guardar al salir de la pestaña, cerrar o cambiar de capítulo.
  useEffect(() => {
    // Al desmontar, video.current ya es null: se captura el elemento ahora.
    const v = video.current;
    const alOcultar = () => {
      if (document.visibilityState === "hidden") guardarAhora();
    };
    window.addEventListener("visibilitychange", alOcultar);
    window.addEventListener("pagehide", guardarAhora);
    return () => {
      window.removeEventListener("visibilitychange", alOcultar);
      window.removeEventListener("pagehide", guardarAhora);
      if (v && empezo.current && v.duration && !Number.isNaN(v.duration)) guardar(ep.id, v.currentTime, v.duration);
    };
  }, [guardarAhora, guardar, ep.id]);

  // Cuenta regresiva al siguiente capítulo.
  useEffect(() => {
    if (fase !== "terminado" || cuenta === null) return;
    if (cuenta <= 0) {
      if (sig) router.push(`/ver/${sig.id}`);
      return;
    }
    const t = setTimeout(() => setCuenta((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [fase, cuenta, sig, router]);

  // Cuando se apaga el modo CORS hay que volver a cargar el video sin el atributo.
  useEffect(() => {
    if (conCors) return;
    const v = video.current;
    if (!v) return;
    const t = v.currentTime;
    if (t > 0) v.addEventListener("loadedmetadata", () => { v.currentTime = t; }, { once: true });
    v.load();
  }, [conCors]);

  const saltearIntro = useCallback(() => {
    const v = video.current;
    if (!v || !marca.intro) return;
    v.currentTime = marca.intro[1];
    setMostrarSaltear(false);
  }, [marca.intro]);

  /** Dibuja el cuadro actual en un canvas y lo guarda como portada. */
  const capturarPortada = useCallback(async (): Promise<string | null> => {
    const v = video.current;
    if (!v) return "No hay video.";
    if (!conCors) return "Para guardar portadas el bucket necesita la política CORS (está en la página subir).";
    if (v.readyState < 2 || !v.videoWidth) return "Esperá a que se vea la imagen.";
    try {
      const ancho = Math.min(640, v.videoWidth);
      const alto = Math.round((ancho * v.videoHeight) / v.videoWidth);
      const canvas = document.createElement("canvas");
      canvas.width = ancho;
      canvas.height = alto;
      const ctx = canvas.getContext("2d");
      if (!ctx) return "El navegador no dejó dibujar el cuadro.";
      ctx.drawImage(v, 0, 0, ancho, alto);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
      if (!blob) return "No pude armar la imagen.";
      const res = await fetch(`/api/arte/${ep.id}`, { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: blob });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return d.error ?? `El sitio respondió ${res.status}.`;
      setMarca((m) => ({ ...m, arte: d.arte }));
      return null;
    } catch {
      return "El navegador no dejó leer el cuadro: el video vino sin permiso CORS.";
    }
  }, [ep.id, conCors]);

  // Atajos de teclado.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      const v = video.current;
      if (!v || fase === "error") return;
      const objetivo = e.target as HTMLElement | null;
      if (objetivo && ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(objetivo.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const salto = (s: number) => {
        v.currentTime = Math.max(0, Math.min(v.duration || Infinity, v.currentTime + s));
      };
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          if (fase === "elegir") return;
          if (v.paused) v.play().catch(() => {});
          else v.pause();
          break;
        case "ArrowLeft":
          e.preventDefault();
          salto(-10);
          break;
        case "ArrowRight":
          e.preventDefault();
          salto(10);
          break;
        case "j":
          salto(-30);
          break;
        case "l":
          salto(30);
          break;
        case "ArrowUp":
          e.preventDefault();
          v.volume = Math.min(1, v.volume + 0.1);
          break;
        case "ArrowDown":
          e.preventDefault();
          v.volume = Math.max(0, v.volume - 0.1);
          break;
        case "m":
          v.muted = !v.muted;
          break;
        case "s":
          if (mostrarSaltear) saltearIntro();
          break;
        case "f":
          // Pantalla completa del contenedor, no del <video>: así las capas siguen visibles.
          if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
          else (pantalla.current ?? v).requestFullscreen?.().catch(() => {});
          break;
        case "n":
          if (sig) {
            guardarAhora();
            router.push(`/ver/${sig.id}`);
          }
          break;
        case "p":
          if (ant) {
            guardarAhora();
            router.push(`/ver/${ant.id}`);
          }
          break;
        default:
          if (/^[0-9]$/.test(e.key) && v.duration) {
            v.currentTime = (Number(e.key) / 10) * v.duration;
          }
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [fase, sig, ant, router, guardarAhora, mostrarSaltear, saltearIntro]);

  const alError = async () => {
    const v = video.current;
    if (!v) return;
    // Primer intento en modo CORS que falla antes de arrancar: casi seguro el
    // bucket no tiene la política CORS. Se vuelve a pedir sin CORS (el video
    // anda igual; sólo no se pueden capturar portadas).
    if (conCors && !probadoSinCors.current && v.currentTime === 0) {
      probadoSinCors.current = true;
      setConCors(false);
      return;
    }
    // Si ya venía andando y falla, lo más probable es que la URL firmada
    // haya vencido tras una pausa larga: se recarga (eso pide una firma
    // nueva) y se sigue desde el mismo punto. Como mucho una vez por minuto,
    // para no entrar en loop si el archivo está roto de verdad.
    const ahora = Date.now();
    if (v.currentTime > 0 && ahora - ultimoReintento.current > 60_000) {
      ultimoReintento.current = ahora;
      const t = v.currentTime;
      v.addEventListener(
        "loadedmetadata",
        () => {
          v.currentTime = t;
          v.play().catch(() => {});
        },
        { once: true },
      );
      v.load();
      return;
    }
    salirDePantallaCompletaNativa();
    setFase("error");
    setError(describirError(v));
    setDiagnostico("Revisando el archivo…");
    try {
      const res = await fetch(`/api/estado/${ep.id}`, { cache: "no-store" });
      if (res.status === 401) {
        setError("Tu sesión venció o tu código ya no está cargado.");
        setDiagnostico("Entrá de nuevo con tu código y seguís desde donde estabas.");
        setSinSesion(true);
        return;
      }
      if (!res.ok) throw new Error();
      const d = await res.json();
      if (d.error) setDiagnostico(d.error);
      else if (!d.existe) setDiagnostico(`No hay ningún archivo llamado ${d.key} en el bucket. Fijate el nombre en Cyberduck.`);
      else if (d.analisis?.veredicto === "ok")
        setDiagnostico(
          d.modo === "demo"
            ? "El clip de muestra está bien. Si no arranca, probá de nuevo o cambiá de navegador: Chrome o Edge, actualizados."
            : "El archivo parece estar bien: video H.264, audio AAC, índice al principio. Probá de nuevo; si sigue fallando, cambiá de navegador (Chrome o Edge, actualizados) o revisá la conexión.",
        );
      else if (d.analisis?.mensaje) setDiagnostico(d.analisis.mensaje);
      else setDiagnostico(null);
    } catch {
      setDiagnostico(null);
    }
  };

  // El <video> viene en el HTML del servidor y puede haber cargado, o fallado,
  // antes de que React se enganche a sus eventos: se mira el estado al montar.
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (v.error) void alError();
    else if (v.readyState >= 1) setDuracion(v.duration || 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alAvanzar = () => {
    const v = video.current;
    if (!v) return;
    if (Date.now() - ultimoGuardado.current > CADA_MS) guardarAhora();
    const dentro = enIntro(marca.intro, v.currentTime);
    if (dentro !== mostrarSaltear) setMostrarSaltear(dentro);
    // Portada automática: una vez por visita, pasado el 20 % (y la intro), si no hay.
    if (
      marcasCargadas &&
      !marca.arte &&
      !capturaIntentada.current &&
      conCors &&
      !v.paused &&
      v.duration &&
      v.currentTime >= Math.max((marca.intro?.[1] ?? 0) + 15, Math.min(v.duration * PORTADA_EN, PORTADA_TOPE_S))
    ) {
      capturaIntentada.current = true;
      void capturarPortada();
    }
  };

  const guardarIntro = async (intro: [number, number] | null) => {
    setGuardando(true);
    setAvisoAjustes(null);
    try {
      const res = await fetch("/api/marcas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ep.id, intro }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? `El sitio respondió ${res.status}.`);
      const mia: Marca = d?.[ep.id] ?? {};
      setMarca(mia);
      setIntroInicio(mia.intro?.[0] ?? null);
      setIntroFin(mia.intro?.[1] ?? null);
      setAvisoAjustes(intro ? "Intro guardada: el botón para saltearla aparece en todos los navegadores." : "Intro borrada.");
    } catch (e) {
      setAvisoAjustes(e instanceof Error ? e.message : "No pude guardar.");
    } finally {
      setGuardando(false);
    }
  };

  const progreso = mapa[ep.id];
  const introLista = introInicio !== null && introFin !== null && introFin > introInicio;

  return (
    <div className="reproductor">
      <div className="reproductor__encabezado">
        <span className="reproductor__temp">
          temporada {ep.temporada}, capítulo {ep.numero}
        </span>
        <h1 className="reproductor__titulo">{ep.titulo}</h1>
        {ep.emision && <span className="reproductor__fecha">emitido el {fechaCorta(ep.emision)}</span>}
      </div>

      <div ref={pantalla} className={`pantalla${fase === "error" ? " pantalla--error" : ""}`}>
        <video
          ref={video}
          controls
          playsInline
          preload="metadata"
          crossOrigin={conCors ? "anonymous" : undefined}
          src={`/api/stream/${ep.id}`}
          onLoadedMetadata={(e) => setDuracion(e.currentTarget.duration || 0)}
          onTimeUpdate={alAvanzar}
          onPause={guardarAhora}
          onPlay={() => {
            empezo.current = true;
            if (fase === "elegir") decidido.current = true;
            setFase("viendo");
          }}
          onEnded={() => {
            salirDePantallaCompletaNativa();
            marcar(ep.id, true);
            setFase("terminado");
            setCuenta(sig ? SEGUNDOS_PARA_SIGUIENTE : null);
          }}
          onError={alError}
        >
          {ep.sub && <track kind="subtitles" srcLang="es" label="español" src={`/api/stream/${ep.id}/sub`} />}
        </video>

        {mostrarSaltear && fase === "viendo" && (
          <button className="boton saltear" onClick={saltearIntro} type="button">
            saltear la intro
          </button>
        )}

        {fase === "elegir" && guardadoInicial.current !== null && (
          <div className="capa">
            <p className="capa__titulo">Lo dejaste en {tiempoTexto(guardadoInicial.current)}.</p>
            <div className="capa__acciones">
              <button className="boton boton--acento" onClick={seguirDesde} autoFocus>
                seguir desde {tiempoTexto(guardadoInicial.current)}
              </button>
              <button className="boton" onClick={desdeCero}>
                empezar de nuevo
              </button>
            </div>
          </div>
        )}

        {fase === "terminado" && (
          <div className="capa">
            {cuenta !== null && sig && (
              <span className="cuenta" aria-hidden="true" style={{ animationDuration: `${SEGUNDOS_PARA_SIGUIENTE}s` }} />
            )}
            <p className="capa__titulo">Terminó.</p>
            {sig ? (
              <>
                <p className="muted">
                  Sigue {codigo(sig)}, {sig.titulo}
                  {cuenta !== null ? `, en ${cuenta}` : ""}.
                </p>
                <div className="capa__acciones">
                  <Link className="boton boton--acento" href={`/ver/${sig.id}`}>
                    ver {codigo(sig)}
                  </Link>
                  <button className="boton" onClick={() => setCuenta(null)}>
                    quedarme acá
                  </button>
                  <button className="boton" onClick={desdeCero}>
                    verlo de nuevo
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="muted">Era el último. Se terminaron los Simuladores.</p>
                <div className="capa__acciones">
                  <Link className="boton" href="/">
                    volver a los capítulos
                  </Link>
                </div>
              </>
            )}
          </div>
        )}

        {fase === "error" && (
          <div className="capa" role="alert">
            <p className="capa__titulo">{error}</p>
            {diagnostico && <p>{diagnostico}</p>}
            <div className="capa__acciones">
              {sinSesion ? (
                <Link className="boton boton--acento" href={`/entrar?a=/ver/${ep.id}`}>
                  entrar de nuevo
                </Link>
              ) : (
                <>
                  <button
                    className="boton"
                    onClick={() => {
                      const v = video.current;
                      const t = v?.currentTime ?? 0;
                      setError(null);
                      setDiagnostico(null);
                      ultimoReintento.current = 0;
                      setFase("viendo");
                      if (v) {
                        if (t > 0) v.addEventListener("loadedmetadata", () => { v.currentTime = t; }, { once: true });
                        v.load();
                      }
                    }}
                  >
                    probar de nuevo
                  </button>
                  <Link className="boton" href="/estado">
                    ver el estado de todos
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="reproductor__pie">
        {ant ? (
          <Link className="boton" href={`/ver/${ant.id}`}>
            anterior: {codigo(ant)}
          </Link>
        ) : (
          <span />
        )}
        {progreso?.visto && <span className="mint">visto</span>}
        {duracion > 0 && <span className="muted num">{tiempoTexto(duracion)}</span>}
        <span className="espacio" />
        {sig && (
          <Link className="boton" href={`/ver/${sig.id}`}>
            siguiente: {codigo(sig)} {sig.titulo}
          </Link>
        )}
      </div>

      <details className="ajustes">
        <summary>intro y portada</summary>
        <div className="ajustes__bloque">
          <div>
            {marca.intro ? (
              <>
                La intro va de <span className="num">{tiempoTexto(marca.intro[0])}</span> a{" "}
                <span className="num">{tiempoTexto(marca.intro[1])}</span>. Mientras pasa, aparece el botón para saltearla,
                también con la tecla <kbd>s</kbd>.
              </>
            ) : (
              <>Marcá dónde empieza y termina la intro de este capítulo, una sola vez, y después se puede saltear.</>
            )}
          </div>
          <div className="ajustes__fila">
            <button
              className="boton boton--chico"
              type="button"
              onClick={() => setIntroInicio(Math.round((video.current?.currentTime ?? 0) * 10) / 10)}
            >
              empieza acá
            </button>
            <span className="num">{introInicio !== null ? tiempoTexto(introInicio) : "–"}</span>
            <button
              className="boton boton--chico"
              type="button"
              onClick={() => setIntroFin(Math.round((video.current?.currentTime ?? 0) * 10) / 10)}
            >
              termina acá
            </button>
            <span className="num">{introFin !== null ? tiempoTexto(introFin) : "–"}</span>
            <button
              className="boton boton--chico"
              type="button"
              disabled={!introLista || guardando}
              onClick={() => guardarIntro([introInicio!, introFin!])}
            >
              guardar la intro
            </button>
            {marca.intro && (
              <button className="boton boton--chico" type="button" disabled={guardando} onClick={() => guardarIntro(null)}>
                borrar
              </button>
            )}
          </div>
          <div className="ajustes__fila">
            <span>
              {marca.arte
                ? "Este capítulo ya tiene portada. Si querés otra, pausá en un buen cuadro y tocá el botón."
                : conCors
                  ? "La portada se guarda sola al minuto de empezar a verlo. O elegila vos: pausá en un buen cuadro y tocá el botón."
                  : "Para guardar portadas el bucket necesita la política CORS que muestra la página subir."}
            </span>
            <button
              className="boton boton--chico"
              type="button"
              disabled={!conCors}
              onClick={async () => {
                setAvisoAjustes(null);
                const problema = await capturarPortada();
                setAvisoAjustes(problema ?? "Portada guardada: ya se ve en la portada del sitio.");
              }}
            >
              usar este cuadro de portada
            </button>
          </div>
          {avisoAjustes && <div className="detalle">{avisoAjustes}</div>}
        </div>
      </details>

      <details className="teclas">
        <summary>teclas</summary>
        <ul>
          <li>
            <kbd>espacio</kbd> pausa y sigue
          </li>
          <li>
            <kbd>←</kbd>
            <kbd>→</kbd> 10 segundos
          </li>
          <li>
            <kbd>j</kbd>
            <kbd>l</kbd> 30 segundos
          </li>
          <li>
            <kbd>↑</kbd>
            <kbd>↓</kbd> volumen
          </li>
          <li>
            <kbd>m</kbd> silencio
          </li>
          <li>
            <kbd>s</kbd> saltear la intro
          </li>
          <li>
            <kbd>f</kbd> pantalla completa
          </li>
          <li>
            <kbd>n</kbd> siguiente capítulo
          </li>
          <li>
            <kbd>p</kbd> capítulo anterior
          </li>
          <li>
            <kbd>0</kbd>…<kbd>9</kbd> saltar al 0%…90%
          </li>
        </ul>
      </details>
    </div>
  );
}
