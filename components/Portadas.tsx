"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Episodio } from "@/lib/episodes";
import type { Marca, Marcas } from "@/lib/marcas";

type Props = { episodios: Pick<Episodio, "id" | "titulo" | "temporada" | "numero">[]; modo: "r2" | "demo" };
type Estado = "pendiente" | "capturando" | "lista" | "fallo";

function esperarEvento(v: HTMLVideoElement, nombres: string[], ms: number): Promise<void> {
  return new Promise((resolver, rechazar) => {
    const limpiar = () => {
      for (const n of nombres) v.removeEventListener(n, ok);
      v.removeEventListener("error", mal);
      clearTimeout(t);
    };
    const ok = () => {
      limpiar();
      resolver();
    };
    const mal = () => {
      limpiar();
      rechazar(new Error(v.error?.code === 4 ? "no-reproducible" : "error-de-carga"));
    };
    const t = setTimeout(() => {
      limpiar();
      rechazar(new Error("tiempo"));
    }, ms);
    for (const n of nombres) v.addEventListener(n, ok, { once: true });
    v.addEventListener("error", mal, { once: true });
  });
}

/** Elige un momento del capítulo y devuelve ese cuadro como JPEG, sin mostrar nada en pantalla. */
async function capturarCuadro(id: string, marca: Marca | undefined): Promise<Blob> {
  const v = document.createElement("video");
  v.crossOrigin = "anonymous";
  v.preload = "auto";
  v.muted = true;
  v.playsInline = true;
  v.src = `/api/stream/${id}`;
  try {
    await esperarEvento(v, ["loadedmetadata"], 25000);
    const duracion = v.duration || 0;
    const objetivo = marca?.intro ? marca.intro[1] + 20 : Math.min(duracion * 0.12, 300);
    v.currentTime = Math.max(0, Math.min(objetivo, duracion - 5));
    await esperarEvento(v, ["seeked"], 30000);
    if (v.readyState < 2) await esperarEvento(v, ["loadeddata", "canplay"], 15000);
    if (!v.videoWidth) throw new Error("sin-imagen");
    const ancho = Math.min(640, v.videoWidth);
    const alto = Math.round((ancho * v.videoHeight) / v.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("sin-canvas");
    try {
      ctx.drawImage(v, 0, 0, ancho, alto);
    } catch {
      throw new Error("cors");
    }
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    if (!blob) throw new Error("sin-imagen");
    return blob;
  } finally {
    v.removeAttribute("src");
    v.load();
  }
}

function explicar(motivo: string): string {
  switch (motivo) {
    case "cors":
      return "El navegador no dejó leer el cuadro: al bucket le falta la política CORS. Está en la página subir, lista para pegar.";
    case "no-reproducible":
      return "El navegador no pudo abrir el video. Fijate el veredicto en la tabla de abajo.";
    case "tiempo":
      return "Tardó demasiado en cargar. Probá de nuevo más tarde.";
    case "sesion":
      return "Tu sesión venció: entrá de nuevo.";
    default:
      return `No se pudo (${motivo}).`;
  }
}

export default function Portadas({ episodios, modo }: Props) {
  const [marcas, setMarcas] = useState<Marcas>({});
  const [cargado, setCargado] = useState(false);
  const [estados, setEstados] = useState<Record<string, { estado: Estado; mensaje?: string }>>({});
  const [corriendo, setCorriendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const detener = useRef(false);

  useEffect(() => {
    fetch("/api/marcas", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : {}))
      .then((m) => setMarcas(m && typeof m === "object" ? (m as Marcas) : {}))
      .catch(() => {})
      .finally(() => setCargado(true));
  }, []);

  const conPortada = episodios.filter((e) => marcas[e.id]?.arte).length;
  const faltan = episodios.filter((e) => !marcas[e.id]?.arte);

  const generar = async () => {
    setCorriendo(true);
    setAviso(null);
    detener.current = false;
    let hechas = 0;
    for (const ep of faltan) {
      if (detener.current) break;
      setEstados((s) => ({ ...s, [ep.id]: { estado: "capturando" } }));
      try {
        const blob = await capturarCuadro(ep.id, marcas[ep.id]);
        const res = await fetch(`/api/arte/${ep.id}`, { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: blob });
        if (res.status === 401) throw new Error("sesion");
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error ?? `respuesta ${res.status}`);
        setMarcas((m) => ({ ...m, [ep.id]: { ...(m[ep.id] ?? {}), arte: d.arte } }));
        setEstados((s) => ({ ...s, [ep.id]: { estado: "lista" } }));
        hechas++;
      } catch (e) {
        const motivo = e instanceof Error ? e.message : "error";
        setEstados((s) => ({ ...s, [ep.id]: { estado: "fallo", mensaje: explicar(motivo) } }));
        if (motivo === "cors" || motivo === "sesion") {
          setAviso(explicar(motivo));
          break;
        }
      }
    }
    setCorriendo(false);
    if (hechas > 0 && !aviso) setAviso(`${hechas} ${hechas === 1 ? "portada nueva" : "portadas nuevas"}. Ya se ven en la portada del sitio.`);
  };

  return (
    <section className="resumen" style={{ marginBottom: 20 }}>
      <dl>
        <dt>portadas</dt>
        <dd>
          {!cargado ? (
            <span className="muted">consultando…</span>
          ) : (
            <>
              <span className="num">{conPortada}</span> de <span className="num">{episodios.length}</span> capítulos con portada.{" "}
              {faltan.length > 0 ? (
                <>
                  Las que faltan se pueden generar acá mismo: el navegador toma un cuadro de cada capítulo y lo guarda.{" "}
                  {modo === "r2" ? "Necesita la política CORS del bucket, la misma que usa la página subir." : ""}
                </>
              ) : (
                "Para cambiar alguna, en el reproductor: intro y portada."
              )}
            </>
          )}
        </dd>
      </dl>
      {cargado && faltan.length > 0 && (
        <div className="ajustes__fila">
          {!corriendo ? (
            <button className="boton boton--chico" type="button" onClick={generar}>
              generar las {faltan.length} que faltan
            </button>
          ) : (
            <button
              className="boton boton--chico"
              type="button"
              onClick={() => {
                detener.current = true;
              }}
            >
              detener
            </button>
          )}
          {corriendo && (
            <span className="muted">
              {Object.values(estados).filter((e) => e.estado === "lista").length} de {faltan.length}, de a una para no saturar…
            </span>
          )}
        </div>
      )}
      {Object.keys(estados).length > 0 && (
        <ul className="portadas">
          {episodios
            .filter((e) => estados[e.id])
            .map((e) => (
              <li key={e.id}>
                <span className="num">
                  {e.temporada}x{String(e.numero).padStart(2, "0")}
                </span>{" "}
                <span className={estados[e.id].estado === "lista" ? "mint" : estados[e.id].estado === "fallo" ? "" : "muted"}>
                  {estados[e.id].estado === "capturando"
                    ? "capturando…"
                    : estados[e.id].estado === "lista"
                      ? "lista"
                      : estados[e.id].mensaje}
                </span>
              </li>
            ))}
        </ul>
      )}
      {aviso && (
        <div className="detalle">
          {aviso}
          {aviso.includes("CORS") && (
            <>
              {" "}
              <Link href="/subir" style={{ textDecoration: "underline" }}>
                ir a subir
              </Link>
            </>
          )}
        </div>
      )}
    </section>
  );
}
