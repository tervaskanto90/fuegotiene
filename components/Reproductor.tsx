"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { codigo, fechaCorta, tiempoTexto, type Episodio } from "@/lib/episodes";
import { reanudable, useProgreso } from "@/lib/progress";

type Props = { ep: Episodio; sig: Episodio | null; ant: Episodio | null };
type Fase = "cargando" | "elegir" | "viendo" | "terminado" | "error";

const CADA_MS = 5000;
const SEGUNDOS_PARA_SIGUIENTE = 12;

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
  }, [fase, sig, ant, router, guardarAhora]);

  const alError = async () => {
    const v = video.current;
    if (!v) return;
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

  const progreso = mapa[ep.id];

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
          src={`/api/stream/${ep.id}`}
          onLoadedMetadata={(e) => setDuracion(e.currentTarget.duration || 0)}
          onTimeUpdate={() => {
            if (Date.now() - ultimoGuardado.current > CADA_MS) guardarAhora();
          }}
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
