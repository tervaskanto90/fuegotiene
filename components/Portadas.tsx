"use client";

import { useEffect, useRef, useState } from "react";
import type { Episodio } from "@/lib/episodes";

type Props = { episodios: Pick<Episodio, "id" | "titulo" | "temporada" | "numero">[]; modo: "r2" | "demo" };
type Estado = "generando" | "lista" | "fallo";

/**
 * Cuenta cuántos capítulos tienen portada y permite generar las que faltan.
 * La portada la saca el servidor con ffmpeg (un cuadro pasado el arranque),
 * así que no depende del navegador ni de la política CORS. Pedirla alcanza:
 * si no existe, el servidor la genera y la guarda.
 */
export default function Portadas({ episodios, modo }: Props) {
  const [conArte, setConArte] = useState<Set<string>>(new Set());
  const [cargado, setCargado] = useState(false);
  const [estados, setEstados] = useState<Record<string, { estado: Estado; mensaje?: string }>>({});
  const [corriendo, setCorriendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const detener = useRef(false);

  useEffect(() => {
    fetch("/api/arte", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { ids: [] }))
      .then((d) => setConArte(new Set(Array.isArray(d?.ids) ? (d.ids as string[]) : [])))
      .catch(() => {})
      .finally(() => setCargado(true));
  }, []);

  const conPortada = episodios.filter((e) => conArte.has(e.id) || estados[e.id]?.estado === "lista").length;
  const faltan = episodios.filter((e) => !conArte.has(e.id) && estados[e.id]?.estado !== "lista");

  const generar = async () => {
    setCorriendo(true);
    setAviso(null);
    detener.current = false;
    let hechas = 0;
    let fallos = 0;
    for (const ep of faltan) {
      if (detener.current) break;
      setEstados((s) => ({ ...s, [ep.id]: { estado: "generando" } }));
      try {
        const res = await fetch(`/api/arte/${ep.id}`, { cache: "no-store" });
        if (res.status === 401) throw new Error("Tu sesión venció: entrá de nuevo.");
        if (!res.ok) throw new Error((await res.text().catch(() => "")) || `el servidor respondió ${res.status}`);
        setEstados((s) => ({ ...s, [ep.id]: { estado: "lista" } }));
        hechas++;
      } catch (e) {
        fallos++;
        setEstados((s) => ({ ...s, [ep.id]: { estado: "fallo", mensaje: e instanceof Error ? e.message : "no se pudo" } }));
        if (fallos >= 3) {
          setAviso("Fallaron tres seguidas: freno acá. Mirá los mensajes de cada una y la tabla de abajo.");
          break;
        }
      }
    }
    setCorriendo(false);
    if (hechas > 0) setAviso(`${hechas} ${hechas === 1 ? "portada nueva" : "portadas nuevas"}. Ya se ven en la portada del sitio.`);
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
              {faltan.length > 0
                ? "Se generan solas la primera vez que alguien abre la portada del sitio; también podés generarlas acá, de a una, y ver si alguna falla."
                : "Para cambiar alguna, en el reproductor: intro y portada."}
              {modo === "demo" && faltan.length > 0 ? " En modo demo salen del clip de muestra." : ""}
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
              {Object.values(estados).filter((e) => e.estado === "lista").length} de {faltan.length}, unos segundos cada una…
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
                  {estados[e.id].estado === "generando"
                    ? "generando…"
                    : estados[e.id].estado === "lista"
                      ? "lista"
                      : estados[e.id].mensaje}
                </span>
              </li>
            ))}
        </ul>
      )}
      {aviso && <div className="detalle">{aviso}</div>}
    </section>
  );
}
