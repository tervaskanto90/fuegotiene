"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EstadoCapitulo } from "@/app/api/estado/[id]/route";
import { codigo, type Episodio } from "@/lib/episodes";

type Props = { episodios: Episodio[]; modo: "r2" | "demo" };
type Fila = { estado: "esperando" | "revisando" | "listo" | "fallo"; datos?: EstadoCapitulo; error?: string };

const EN_PARALELO = 3;

function peso(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function chip(d: EstadoCapitulo | undefined, fila: Fila): { clase: string; texto: string } {
  if (fila.estado === "esperando") return { clase: "chip--falta", texto: "en cola" };
  if (fila.estado === "revisando") return { clase: "chip--falta", texto: "revisando…" };
  if (fila.estado === "fallo" || !d) return { clase: "chip--mal", texto: "no pude revisar" };
  if (d.error) return { clase: "chip--mal", texto: "error" };
  if (!d.existe) return { clase: "chip--falta", texto: "no está en el bucket" };
  switch (d.analisis?.veredicto) {
    case "ok":
      return { clase: "chip--ok", texto: d.modo === "demo" ? "demo, anda" : "listo" };
    case "sin-audio":
      return { clase: "chip--mal", texto: "sin sonido" };
    case "arranque-lento":
      return { clase: "chip--mal", texto: "arranque lento" };
    case "no-reproducible":
      return { clase: "chip--mal", texto: "no se reproduce" };
    default:
      return { clase: "chip--mal", texto: "raro" };
  }
}

export default function Estado({ episodios, modo }: Props) {
  const [filas, setFilas] = useState<Record<string, Fila>>(() =>
    Object.fromEntries(episodios.map((e) => [e.id, { estado: "esperando" as const }])),
  );
  const [ronda, setRonda] = useState(0);
  const cancelado = useRef(false);

  const revisar = useCallback(async () => {
    cancelado.current = false;
    setFilas(Object.fromEntries(episodios.map((e) => [e.id, { estado: "esperando" as const }])));
    const cola = [...episodios];
    const trabajador = async () => {
      while (cola.length && !cancelado.current) {
        const ep = cola.shift()!;
        setFilas((f) => ({ ...f, [ep.id]: { estado: "revisando" } }));
        try {
          const res = await fetch(`/api/estado/${ep.id}`, { cache: "no-store" });
          if (!res.ok) throw new Error(`respuesta ${res.status}`);
          const datos = (await res.json()) as EstadoCapitulo;
          setFilas((f) => ({ ...f, [ep.id]: { estado: "listo", datos } }));
        } catch (e) {
          setFilas((f) => ({ ...f, [ep.id]: { estado: "fallo", error: e instanceof Error ? e.message : "error" } }));
        }
      }
    };
    await Promise.all(Array.from({ length: EN_PARALELO }, trabajador));
  }, [episodios]);

  useEffect(() => {
    revisar();
    return () => {
      cancelado.current = true;
    };
  }, [revisar, ronda]);

  const listos = Object.values(filas).filter((f) => f.datos?.analisis?.veredicto === "ok").length;
  const faltan = Object.values(filas).filter((f) => f.estado === "listo" && f.datos && !f.datos.existe && !f.datos.error).length;
  const conProblemas = Object.values(filas).filter(
    (f) => f.datos && (f.datos.error || (f.datos.existe && f.datos.analisis && f.datos.analisis.veredicto !== "ok")),
  ).length;
  const pendientes = Object.values(filas).filter((f) => f.estado === "esperando" || f.estado === "revisando").length;

  return (
    <section className="seccion" style={{ marginTop: 0 }}>
      <h2 className="seccion__titulo">
        capítulos en {modo === "r2" ? "el bucket" : "modo demo"}
        <span className="num">
          {pendientes > 0
            ? `revisando ${episodios.length - pendientes}/${episodios.length}`
            : `${listos} listos, ${conProblemas} con problemas, ${faltan} faltan`}
        </span>
        <button className="boton boton--chico" style={{ marginLeft: "auto" }} onClick={() => setRonda((r) => r + 1)} disabled={pendientes > 0}>
          revisar de nuevo
        </button>
      </h2>
      {modo === "demo" && (
        <p className="muted" style={{ marginBottom: 14 }}>
          Sin R2 configurado todos los capítulos apuntan al clip de muestra. Cuando cargues las variables de R2 en
          Vercel y hagas Redeploy, acá vas a ver si cada archivo está y si el navegador lo puede reproducir.
        </p>
      )}
      <div className="envoltorio">
        <table className="tabla">
          <thead>
            <tr>
              <th className="num">capítulo</th>
              <th>archivo</th>
              <th>resultado</th>
              <th className="num">peso</th>
              <th>video</th>
              <th>audio</th>
            </tr>
          </thead>
          <tbody>
            {episodios.map((ep) => {
              const fila = filas[ep.id];
              const d = fila?.datos;
              const c = chip(d, fila);
              const video = d?.analisis?.pistas.filter((p) => p.tipo === "video") ?? [];
              const audio = d?.analisis?.pistas.filter((p) => p.tipo === "audio") ?? [];
              return (
                <tr key={ep.id}>
                  <td className="num">
                    {codigo(ep)} <span className="muted">{ep.titulo}</span>
                  </td>
                  <td className="narrow">
                    {ep.key}
                    {d?.sub && (
                      <div className="detalle">
                        {d.sub.key}: {d.sub.existe ? "está" : "no está"}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`chip ${c.clase}`}>{c.texto}</span>
                    {d?.error && <div className="detalle">{d.error}</div>}
                    {fila?.error && <div className="detalle">{fila.error}</div>}
                    {d?.existe && d.analisis && (
                      <div className="detalle">
                        {d.analisis.mensaje}
                        {d.analisis.moovPrimero === false && d.analisis.veredicto !== "arranque-lento" ? "" : ""}
                      </div>
                    )}
                    {d && !d.existe && !d.error && (
                      <div className="detalle">
                        Subilo con Cyberduck con ese nombre exacto, o cambiá el campo key en data/episodes.json.
                      </div>
                    )}
                  </td>
                  <td className="num">{peso(d?.tamano ?? null)}</td>
                  <td>
                    {video.map((p, i) => (
                      <div key={i}>
                        {p.codec}
                        {p.detalle && <div className="detalle">{p.detalle}</div>}
                      </div>
                    ))}
                  </td>
                  <td>
                    {audio.map((p, i) => (
                      <div key={i}>
                        {p.codec}
                        {p.detalle && <div className="detalle">{p.detalle}</div>}
                      </div>
                    ))}
                    {d?.existe && d.analisis && audio.length === 0 && d.analisis.contenedor === "mp4" && (
                      <span className="muted">sin pista</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
