"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Adelante10,
  Atras10,
  Flecha,
  PantallaCompleta,
  Pausa,
  Play,
  SalirPantalla,
  Siguiente,
  Silencio,
  Subtitulos,
  Volumen,
} from "@/components/Iconos";
import { codigo, fechaCorta, tiempoTexto, type Episodio } from "@/lib/episodes";
import type { Marca, Marcas } from "@/lib/marcas";
import { reanudable, useProgreso } from "@/lib/progress";

type Props = { ep: Episodio; sig: Episodio | null; ant: Episodio | null };
type Fase = "cargando" | "viendo" | "terminado" | "error";

const CADA_MS = 5000;
const SEGUNDOS_PARA_SIGUIENTE = 12;
const OCULTAR_MS = 3000;
/** Con el dedo los controles duran más: no hay "mover el mouse" para revivirlos. */
const OCULTAR_TACTIL_MS = 5000;
/** Dos toques seguidos en un costado saltan 10 s, como en cualquier reproductor de teléfono. */
const DOBLE_TOQUE_MS = 320;
/** La portada se captura sola pasado este punto del capítulo (o al minuto, lo que llegue antes), si no hay una. */
const PORTADA_EN = 0.2;
const PORTADA_TOPE_S = 60;
const CLAVE_VOLUMEN = "ft.volumen";

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

function esTactil(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

export default function Reproductor({ ep, sig, ant }: Props) {
  // /estado y /subir son del dueño del sitio: al resto no se le ofrece un
  // enlace que lo va a rebotar. Lo dice /api/estado/[id], a quien el
  // reproductor ya le pregunta cuando un video falla.
  const [dueno, setDueno] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const pantalla = useRef<HTMLDivElement>(null);
  const barra = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { mapa, listo, guardar, marcar } = useProgreso();

  const [fase, setFase] = useState<Fase>("cargando");
  const [error, setError] = useState<string | null>(null);
  const [diagnostico, setDiagnostico] = useState<string | null>(null);
  const [cuenta, setCuenta] = useState<number | null>(null);
  const [sinSesion, setSinSesion] = useState(false);

  // Estado visible del reproductor.
  const [reproduciendo, setReproduciendo] = useState(false);
  const [tiempo, setTiempo] = useState(0);
  const [duracion, setDuracion] = useState(0);
  const [bufferHasta, setBufferHasta] = useState(0);
  const [volumen, setVolumen] = useState(1);
  const [silencio, setSilencio] = useState(false);
  const [pantallaCompleta, setPantallaCompleta] = useState(false);
  const [visibles, setVisibles] = useState(true);
  const [subsActivos, setSubsActivos] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [hoverT, setHoverT] = useState<number | null>(null);
  const [sinImagen, setSinImagen] = useState<string | null>(null);
  /** -1 o 1 mientras se muestra el cartel de "10 s" del doble toque. */
  const [salto, setSalto] = useState<-1 | 1 | null>(null);

  // Lo anotado del capítulo: si ya tiene portada. Vive en el bucket, compartido.
  const [marca, setMarca] = useState<Marca>({});
  const [marcasCargadas, setMarcasCargadas] = useState(false);

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
  const temporizadorOcultar = useRef(0);
  const temporizadorSalto = useRef(0);
  const reproduciendoRef = useRef(false);
  const arrastrandoRef = useRef(false);
  /** Los controles tal como estaban cuando el dedo tocó la pantalla, antes de que el toque los prenda. */
  const visiblesRef = useRef(true);
  const visiblesAlTocar = useRef(true);
  const ultimoToque = useRef({ t: 0, x: 0 });
  const imagenRevisada = useRef(false);

  useEffect(() => {
    reproduciendoRef.current = reproduciendo;
  }, [reproduciendo]);
  useEffect(() => {
    visiblesRef.current = visibles;
  }, [visibles]);
  useEffect(() => {
    arrastrandoRef.current = arrastrando;
  }, [arrastrando]);

  const guardarAhora = useCallback(() => {
    const v = video.current;
    if (!empezo.current || !v || !v.duration || Number.isNaN(v.duration)) return;
    guardar(ep.id, v.currentTime, v.duration);
    ultimoGuardado.current = Date.now();
  }, [ep.id, guardar]);

  /** Muestra los controles y programa que se escondan solos si el video anda. */
  const despertar = useCallback(() => {
    setVisibles(true);
    window.clearTimeout(temporizadorOcultar.current);
    temporizadorOcultar.current = window.setTimeout(() => {
      if (reproduciendoRef.current && !arrastrandoRef.current) setVisibles(false);
    }, esTactil() ? OCULTAR_TACTIL_MS : OCULTAR_MS);
  }, []);

  /** El dedo toca: se anota cómo estaban los controles antes, porque el click que
      viene después decide con eso. Sin esto el touchstart los prende y el click los
      apaga en el mismo toque, que es el parpadeo que se veía en el teléfono. */
  const alTocarPantalla = useCallback(() => {
    visiblesAlTocar.current = visiblesRef.current;
    despertar();
  }, [despertar]);

  useEffect(() => {
    if (!reproduciendo) {
      setVisibles(true);
      window.clearTimeout(temporizadorOcultar.current);
    } else {
      despertar();
    }
  }, [reproduciendo, despertar]);

  // Volumen recordado.
  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(CLAVE_VOLUMEN);
      if (guardado) {
        const { v, m } = JSON.parse(guardado) as { v: number; m: boolean };
        setVolumen(v);
        setSilencio(m);
        if (video.current) {
          video.current.volume = v;
          video.current.muted = m;
        }
      }
    } catch {
      // sin localStorage
    }
  }, []);

  const aplicarVolumen = (v: number, m: boolean) => {
    const el = video.current;
    if (el) {
      el.volume = v;
      el.muted = m;
    }
    setVolumen(v);
    setSilencio(m);
    try {
      window.localStorage.setItem(CLAVE_VOLUMEN, JSON.stringify({ v, m }));
    } catch {
      // sin localStorage
    }
  };

  // Anotaciones: una consulta al montar.
  useEffect(() => {
    let vivo = true;
    fetch("/api/marcas", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : {}))
      .then((m: Marcas) => {
        if (!vivo) return;
        const mia = m?.[ep.id] ?? {};
        setMarca(mia);
      })
      .catch(() => {})
      .finally(() => {
        if (vivo) setMarcasCargadas(true);
      });
    return () => {
      vivo = false;
    };
  }, [ep.id]);

  // Con el progreso leído: reanudar donde quedó y arrancar solo, como en las plataformas.
  useEffect(() => {
    if (!listo || decidido.current) return;
    const p = mapa[ep.id];
    guardadoInicial.current = reanudable(p) ? p!.t : null;
    // Se lee de window y no de useSearchParams para que la página se pueda
    // prerenderizar entera, con el <video> incluido.
    const params = new URLSearchParams(window.location.search);
    const desde = params.get("desde");
    const v = video.current;
    decidido.current = true;
    if (v && !v.paused && !v.ended) {
      // Play nativo antes de que React se enganchara: no hay nada que decidir.
      empezo.current = true;
      setFase("viendo");
      return;
    }
    setFase("viendo");
    if (!v) return;
    if (desde !== "0" && guardadoInicial.current !== null) {
      const t = guardadoInicial.current;
      v.currentTime = t;
      setTiempo(t);
    }
    // Si el navegador no deja arrancar solo, queda el botón grande de play.
    v.play().catch(() => {});
  }, [listo, mapa, ep.id]);

  /** Los controles nativos ya no se usan, pero por las dudas: si algo puso el <video> solo en pantalla completa, salir. */
  const salirDePantallaCompletaNativa = () => {
    if (document.fullscreenElement && document.fullscreenElement !== pantalla.current) {
      document.exitFullscreen().catch(() => {});
    }
  };

  useEffect(() => {
    const alCambiar = () => setPantallaCompleta(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", alCambiar);
    return () => document.removeEventListener("fullscreenchange", alCambiar);
  }, []);

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
    v.play().catch(() => {});
  }, [conCors]);

  // Subtítulos.
  useEffect(() => {
    const v = video.current;
    if (!v || !ep.sub) return;
    const pista = v.textTracks[0];
    if (pista) pista.mode = subsActivos ? "showing" : "hidden";
  }, [subsActivos, ep.sub]);

  const alternarPlay = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, []);

  const saltar = useCallback((s: number) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || Infinity, v.currentTime + s));
    setTiempo(v.currentTime);
  }, []);

  const alternarPantallaCompleta = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      return;
    }
    if (document.fullscreenEnabled && pantalla.current?.requestFullscreen) {
      pantalla.current.requestFullscreen().catch(() => {});
      return;
    }
    // iPhone: Safari no pone un <div> a pantalla completa, sólo el <video>, y ahí
    // manda sus propios controles. Es el único caso donde se le cede la pantalla.
    const v = video.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    v?.webkitEnterFullscreen?.();
  }, []);

  /** Si el navegador no sabe hacer ninguna de las dos, el botón no va: ya ocupa la ventana entera. */
  const [hayPantallaCompleta, setHayPantallaCompleta] = useState(true);
  useEffect(() => {
    const v = video.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    setHayPantallaCompleta(document.fullscreenEnabled || typeof v?.webkitEnterFullscreen === "function");
  }, []);

  /** Dibuja el cuadro actual en un canvas y lo guarda como portada del capítulo.
      Corre sola, una vez por visita, y si no sale no se dice nada: la portada
      también la puede generar el servidor con ffmpeg cuando alguien la pida. */
  const capturarPortada = useCallback(async () => {
    const v = video.current;
    if (!v || !conCors || v.readyState < 2 || !v.videoWidth) return;
    try {
      const ancho = Math.min(640, v.videoWidth);
      const alto = Math.round((ancho * v.videoHeight) / v.videoWidth);
      const canvas = document.createElement("canvas");
      canvas.width = ancho;
      canvas.height = alto;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, ancho, alto);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
      if (!blob) return;
      const res = await fetch(`/api/arte/${ep.id}`, { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: blob });
      if (!res.ok) return;
      const d = await res.json().catch(() => ({}));
      setMarca((m) => ({ ...m, arte: d.arte }));
    } catch {
      // El video vino sin permiso CORS: la portada la genera el servidor.
    }
  }, [ep.id, conCors]);

  // Atajos de teclado.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      const v = video.current;
      if (!v || fase === "error") return;
      const objetivo = e.target as HTMLElement | null;
      if (objetivo && ["INPUT", "TEXTAREA", "SELECT"].includes(objetivo.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (objetivo && ["BUTTON", "A"].includes(objetivo.tagName) && (e.key === " " || e.key === "Enter")) return;
      despertar();
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          alternarPlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          saltar(-10);
          break;
        case "ArrowRight":
          e.preventDefault();
          saltar(10);
          break;
        case "j":
          saltar(-30);
          break;
        case "l":
          saltar(30);
          break;
        case "ArrowUp":
          e.preventDefault();
          aplicarVolumen(Math.min(1, v.volume + 0.1), false);
          break;
        case "ArrowDown":
          e.preventDefault();
          aplicarVolumen(Math.max(0, v.volume - 0.1), v.volume - 0.1 <= 0);
          break;
        case "m":
          aplicarVolumen(v.volume, !v.muted);
          break;
        case "c":
          if (ep.sub) setSubsActivos((s) => !s);
          break;
        case "f":
          alternarPantallaCompleta();
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
            setTiempo(v.currentTime);
          }
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, sig, ant, router, guardarAhora, alternarPlay, saltar, alternarPantallaCompleta, despertar, ep.sub]);

  const alError = async () => {
    const v = video.current;
    if (!v) return;
    // Primer intento en modo CORS que falla antes de arrancar: casi seguro el
    // bucket no tiene la política CORS. Se vuelve a pedir sin CORS (el video
    // anda igual; sólo no sale la portada que captura el reproductor).
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
      setDueno(!!d.dueno);
      if (d.error) setDiagnostico(d.error);
      else if (!d.existe) setDiagnostico(`No hay ningún archivo llamado ${d.key} en el bucket. Fijate el nombre en la página subir.`);
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

  // Se escucha pero no se ve: el navegador descartó la pista de video.
  const revisarImagen = () => {
    const v = video.current;
    if (!v || imagenRevisada.current) return;
    imagenRevisada.current = true;
    window.setTimeout(async () => {
      if (!video.current || video.current.videoWidth > 0) return;
      setSinImagen("Se escucha pero no se ve la imagen: el navegador no reconoce el formato del video.");
      try {
        const res = await fetch(`/api/estado/${ep.id}`, { cache: "no-store" });
        const d = res.ok ? await res.json() : null;
        if (d) setDueno(!!d.dueno);
        if (d?.analisis?.mensaje) setSinImagen(`Se escucha pero no se ve la imagen. ${d.analisis.mensaje}`);
      } catch {
        // queda el mensaje general
      }
    }, 1500);
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
    if (!arrastrando) setTiempo(v.currentTime);
    if (Date.now() - ultimoGuardado.current > CADA_MS) guardarAhora();
    // Portada automática: una vez por visita, si no hay.
    if (
      marcasCargadas &&
      !marca.arte &&
      !capturaIntentada.current &&
      conCors &&
      !v.paused &&
      v.duration &&
      v.currentTime >= Math.min(v.duration * PORTADA_EN, PORTADA_TOPE_S)
    ) {
      capturaIntentada.current = true;
      void capturarPortada();
    }
  };

  const alProgresar = () => {
    const v = video.current;
    if (!v) return;
    for (let i = 0; i < v.buffered.length; i++) {
      if (v.buffered.start(i) <= v.currentTime && v.currentTime <= v.buffered.end(i)) {
        setBufferHasta(v.buffered.end(i));
        return;
      }
    }
  };

  // Barra de tiempo: arrastre y vista previa.
  const razonDe = (clientX: number) => {
    const r = barra.current?.getBoundingClientRect();
    if (!r || r.width === 0) return 0;
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };
  const alPresionarBarra = (e: React.PointerEvent<HTMLDivElement>) => {
    const v = video.current;
    if (!v || !v.duration) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setArrastrando(true);
    const t = razonDe(e.clientX) * v.duration;
    v.currentTime = t;
    setTiempo(t);
  };
  const alMoverBarra = (e: React.PointerEvent<HTMLDivElement>) => {
    const v = video.current;
    if (!v || !v.duration) return;
    const t = razonDe(e.clientX) * v.duration;
    setHoverT(t);
    if (arrastrando) {
      v.currentTime = t;
      setTiempo(t);
    }
  };
  const alSoltarBarra = () => setArrastrando(false);

  /** Clic sobre el video: con mouse, pausa y sigue. Con el dedo, muestra o esconde
      los controles — y dos toques seguidos en un costado saltan 10 segundos. */
  const alClicPantalla = (e: React.MouseEvent<HTMLDivElement>) => {
    const objetivo = e.target as HTMLElement;
    if (objetivo.closest("button, a, input, .cine__abajo, .capa, .aviso-cine")) return;
    if (fase !== "viendo") return;
    if (!esTactil()) {
      alternarPlay();
      return;
    }

    const ahora = Date.now();
    const anterior = ultimoToque.current;
    const ancho = pantalla.current?.clientWidth ?? 0;
    const zona = ancho > 0 ? (e.clientX < ancho * 0.33 ? -1 : e.clientX > ancho * 0.67 ? 1 : 0) : 0;
    ultimoToque.current = { t: ahora, x: e.clientX };

    // Segundo toque rápido en el mismo costado: salta y deja los controles puestos.
    if (zona !== 0 && ahora - anterior.t < DOBLE_TOQUE_MS && Math.abs(e.clientX - anterior.x) < ancho * 0.2) {
      saltar(zona * 10);
      setSalto(zona);
      window.clearTimeout(temporizadorSalto.current);
      temporizadorSalto.current = window.setTimeout(() => setSalto(null), 520);
      ultimoToque.current = { t: 0, x: 0 };
      despertar();
      return;
    }

    // Toque simple: si estaban escondidos, el touchstart ya los mostró y se quedan.
    if (visiblesAlTocar.current) {
      setVisibles(false);
      window.clearTimeout(temporizadorOcultar.current);
    }
  };
  const alDobleClic = (e: React.MouseEvent<HTMLDivElement>) => {
    const objetivo = e.target as HTMLElement;
    if (objetivo.closest("button, a, input, .cine__abajo, .capa")) return;
    if (!esTactil()) alternarPantallaCompleta();
  };

  const pct = duracion > 0 ? (tiempo / duracion) * 100 : 0;
  const pctBuffer = duracion > 0 ? Math.min(100, (bufferHasta / duracion) * 100) : 0;
  const mostrarControles = visibles || !reproduciendo || fase !== "viendo";

  return (
    <div
      ref={pantalla}
      className={`cine${mostrarControles ? "" : " cine--oculto"}${fase === "error" ? " cine--error" : ""}`}
      onMouseMove={despertar}
      onTouchStart={alTocarPantalla}
      onClick={alClicPantalla}
      onDoubleClick={alDobleClic}
    >
      {/* El video no se puede blindar: el navegador tiene que bajar los bytes para
          mostrarlos. Lo que sí se cierran son los caminos de un clic — el menú del
          botón derecho, el toque largo del teléfono, el arrastre y el botón de
          descarga que aparece si algún navegador muestra sus controles nativos. */}
      <video
        ref={video}
        playsInline
        preload="metadata"
        controlsList="nodownload noplaybackrate noremoteplayback"
        disablePictureInPicture
        disableRemotePlayback
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
        crossOrigin={conCors ? "anonymous" : undefined}
        src={`/api/stream/${ep.id}`}
        onLoadedMetadata={(e) => setDuracion(e.currentTarget.duration || 0)}
        onDurationChange={(e) => setDuracion(e.currentTarget.duration || 0)}
        onTimeUpdate={alAvanzar}
        onProgress={alProgresar}
        onPlaying={revisarImagen}
        onPause={() => {
          setReproduciendo(false);
          guardarAhora();
        }}
        onPlay={() => {
          empezo.current = true;
          setReproduciendo(true);
          setFase("viendo");
        }}
        onEnded={() => {
          setReproduciendo(false);
          salirDePantallaCompletaNativa();
          marcar(ep.id, true);
          setFase("terminado");
          setCuenta(sig ? SEGUNDOS_PARA_SIGUIENTE : null);
        }}
        onError={alError}
      >
        {ep.sub && <track kind="subtitles" srcLang="es" label="español" src={`/api/stream/${ep.id}/sub`} />}
      </video>

      <div className="cine__sombra" aria-hidden="true" />

      {salto !== null && (
        <div className={`cine__salto cine__salto--${salto === 1 ? "adelante" : "atras"}`} aria-hidden="true">
          <span className="narrow">10 s</span>
        </div>
      )}

      <div className="cine__arriba">
        <Link href="/" className="cine__volver" onClick={guardarAhora} aria-label="volver a los capítulos">
          <Flecha />
          <span>capítulos</span>
        </Link>
        <div className="cine__titulos">
          <span className="cine__temp narrow">{codigo(ep)}</span>
          <span className="cine__titulo">{ep.titulo}</span>
          {ep.emision && <span className="cine__fecha">{fechaCorta(ep.emision)}</span>}
        </div>
      </div>

      {fase === "viendo" && (
        <div className="cine__centro">
          <button className="cine__grande cine__grande--lado" type="button" onClick={() => saltar(-10)} aria-label="atrás 10 segundos">
            <Atras10 />
          </button>
          <button className="cine__grande" type="button" onClick={alternarPlay} aria-label={reproduciendo ? "pausar" : "reproducir"}>
            {reproduciendo ? <Pausa /> : <Play />}
          </button>
          <button className="cine__grande cine__grande--lado" type="button" onClick={() => saltar(10)} aria-label="adelante 10 segundos">
            <Adelante10 />
          </button>
        </div>
      )}

      {sinImagen && fase === "viendo" && (
        <div className="aviso aviso-cine" role="alert">
          {sinImagen}{" "}
          {dueno ? (
            <>
              Hay que convertir este capítulo: cómo hacerlo está en la página{" "}
              <Link href="/estado" style={{ textDecoration: "underline" }}>
                estado
              </Link>
              .
            </>
          ) : (
            <>Hay que convertir este capítulo: avisale al que armó el sitio.</>
          )}
        </div>
      )}

      <div className="cine__abajo">
        <div
          ref={barra}
          className={`barra-t${arrastrando ? " barra-t--arrastrando" : ""}`}
          onPointerDown={alPresionarBarra}
          onPointerMove={alMoverBarra}
          onPointerUp={alSoltarBarra}
          onPointerCancel={alSoltarBarra}
          onPointerLeave={() => {
            setHoverT(null);
            if (!arrastrando) return;
            setArrastrando(false);
          }}
          role="slider"
          aria-label="posición"
          aria-valuemin={0}
          aria-valuemax={Math.round(duracion)}
          aria-valuenow={Math.round(tiempo)}
          aria-valuetext={tiempoTexto(tiempo)}
        >
          <div className="barra-t__pista">
            <div className="barra-t__buffer" style={{ width: `${pctBuffer}%` }} />
            <div className="barra-t__visto" style={{ width: `${pct}%` }} />
            <div className="barra-t__punto" style={{ left: `${pct}%` }} />
          </div>
          {hoverT !== null && duracion > 0 && (
            <div className="barra-t__tip" style={{ left: `${(hoverT / duracion) * 100}%` }}>
              {tiempoTexto(hoverT)}
            </div>
          )}
        </div>

        <div className="cine__controles">
          <button className="cine__boton cine__boton--tambien-arriba" type="button" onClick={alternarPlay} aria-label={reproduciendo ? "pausar" : "reproducir"}>
            {reproduciendo ? <Pausa /> : <Play />}
          </button>
          <button className="cine__boton cine__boton--tambien-arriba" type="button" onClick={() => saltar(-10)} aria-label="atrás 10 segundos">
            <Atras10 />
          </button>
          <button className="cine__boton cine__boton--tambien-arriba" type="button" onClick={() => saltar(10)} aria-label="adelante 10 segundos">
            <Adelante10 />
          </button>
          <div className="cine__volumen">
            <button className="cine__boton" type="button" onClick={() => aplicarVolumen(volumen, !silencio)} aria-label={silencio ? "activar sonido" : "silenciar"}>
              {silencio || volumen === 0 ? <Silencio /> : <Volumen />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={silencio ? 0 : volumen}
              onChange={(e) => aplicarVolumen(Number(e.target.value), Number(e.target.value) === 0)}
              aria-label="volumen"
            />
          </div>
          <span className="cine__tiempo">
            {tiempoTexto(tiempo)} <span className="muted">/ {tiempoTexto(duracion)}</span>
          </span>
          <span className="cine__espacio" />
          {sig && (
            <Link className="cine__siguiente" href={`/ver/${sig.id}`} onClick={guardarAhora}>
              <Siguiente />
              <span className="narrow">{codigo(sig)}</span>
              <span className="titulo">{sig.titulo}</span>
            </Link>
          )}
          {ep.sub && (
            <button
              className={`cine__boton${subsActivos ? " cine__boton--activo" : ""}`}
              type="button"
              onClick={() => setSubsActivos((s) => !s)}
              aria-label={subsActivos ? "sacar subtítulos" : "poner subtítulos"}
              aria-pressed={subsActivos}
            >
              <Subtitulos />
            </button>
          )}
{hayPantallaCompleta && (
            <button className="cine__boton" type="button" onClick={alternarPantallaCompleta} aria-label={pantallaCompleta ? "salir de pantalla completa" : "pantalla completa"}>
              {pantallaCompleta ? <SalirPantalla /> : <PantallaCompleta />}
            </button>
          )}
        </div>
      </div>

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
                <button
                  className="boton"
                  onClick={() => {
                    const v = video.current;
                    if (!v) return;
                    v.currentTime = 0;
                    setFase("viendo");
                    v.play().catch(() => {});
                  }}
                >
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
                      v.play().catch(() => {});
                    }
                  }}
                >
                  probar de nuevo
                </button>
                {dueno && (
                  <Link className="boton" href="/estado">
                    ver el estado de todos
                  </Link>
                )}
                <Link className="boton" href="/">
                  volver a los capítulos
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
