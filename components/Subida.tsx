"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { politicaCors } from "@/lib/r2";

type Props = { modo: "r2" | "demo"; bucket: string | null; esperados: string[] };

type Item = {
  id: number;
  archivo: File;
  estado: "cola" | "pidiendo" | "subiendo" | "listo" | "error";
  pct: number;
  mensaje: string;
  cors: boolean;
};

const EN_PARALELO = 2;

function peso(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function subirConProgreso(url: string, archivo: File, alProgresar: (pct: number) => void): Promise<void> {
  return new Promise((resolver, rechazar) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) alProgresar(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolver();
      else rechazar(new Error(`estado ${xhr.status}`));
    };
    xhr.onerror = () => rechazar(new Error("red"));
    xhr.onabort = () => rechazar(new Error("cancelado"));
    xhr.send(archivo);
  });
}

export default function Subida({ modo, bucket, esperados }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const [origen, setOrigen] = useState("https://TU-SITIO.vercel.app");
  const [copiado, setCopiado] = useState(false);
  const siguienteId = useRef(1);
  const corriendo = useRef(false);
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOrigen(window.location.origin);
  }, []);

  const esperadosSet = useMemo(() => new Set(esperados), [esperados]);

  const agregar = (lista: FileList | File[]) => {
    const nuevos: Item[] = [];
    for (const archivo of Array.from(lista)) {
      nuevos.push({ id: siguienteId.current++, archivo, estado: "cola", pct: 0, mensaje: "", cors: false });
    }
    setItems((prev) => {
      const nombres = new Set(prev.map((i) => i.archivo.name));
      return [...prev, ...nuevos.filter((n) => !nombres.has(n.archivo.name))];
    });
  };

  const actualizar = (id: number, cambio: Partial<Item>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...cambio } : i)));

  const subirUno = useCallback(
    async (item: Item) => {
      actualizar(item.id, { estado: "pidiendo", mensaje: "" });
      let url: string;
      try {
        const res = await fetch("/api/subir", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre: item.archivo.name, tamano: item.archivo.size }),
        });
        const datos = await res.json().catch(() => ({}));
        if (res.status === 401) throw new Error("Tu sesión venció: entrá de nuevo y volvé a intentar.");
        if (!res.ok) throw new Error(datos.error ?? `El sitio respondió ${res.status}.`);
        url = datos.url;
      } catch (e) {
        actualizar(item.id, { estado: "error", mensaje: e instanceof Error ? e.message : "No pude pedir la URL de subida." });
        return;
      }
      actualizar(item.id, { estado: "subiendo", pct: 0 });
      try {
        await subirConProgreso(url, item.archivo, (pct) => actualizar(item.id, { pct }));
        actualizar(item.id, { estado: "listo", pct: 100, mensaje: "" });
      } catch (e) {
        const motivo = e instanceof Error ? e.message : "";
        if (motivo === "red") {
          actualizar(item.id, {
            estado: "error",
            cors: true,
            mensaje: "El navegador no pudo hablar con R2. Casi siempre es que al bucket le falta la política CORS: está más abajo, lista para pegar.",
          });
        } else if (motivo === "estado 403") {
          actualizar(item.id, { estado: "error", mensaje: "R2 rechazó la subida (403). El token necesita permiso de escritura sobre el bucket, o la URL venció: probá de nuevo." });
        } else {
          actualizar(item.id, { estado: "error", mensaje: `La subida falló (${motivo}). Probá de nuevo.` });
        }
      }
    },
    [],
  );

  // Cola: de a dos, en orden.
  useEffect(() => {
    if (corriendo.current) return;
    const enCurso = items.filter((i) => i.estado === "pidiendo" || i.estado === "subiendo").length;
    const proximo = items.find((i) => i.estado === "cola");
    if (!proximo || enCurso >= EN_PARALELO) return;
    corriendo.current = true;
    subirUno(proximo).finally(() => {
      corriendo.current = false;
      // fuerza otra pasada del efecto
      setItems((prev) => [...prev]);
    });
  }, [items, subirUno]);

  const listos = items.filter((i) => i.estado === "listo").length;
  const conError = items.filter((i) => i.estado === "error").length;
  const activos = items.filter((i) => i.estado !== "listo" && i.estado !== "error").length;
  const hayCors = items.some((i) => i.cors);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(politicaCors(origen));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } catch {
      // sin permiso de portapapeles: queda el texto seleccionable
    }
  };

  if (modo === "demo") {
    return (
      <section className="seccion" style={{ marginTop: 0 }}>
        <h1 className="destacado__titulo">subir capítulos</h1>
        <p className="aviso" style={{ marginTop: 16 }}>
          Sin R2 configurado no hay dónde subir. Cargá las cuatro variables de R2 en Vercel y hacé Redeploy; después
          volvé acá.
        </p>
      </section>
    );
  }

  return (
    <section className="seccion" style={{ marginTop: 0 }}>
      <div className="reproductor__encabezado" style={{ marginBottom: 14 }}>
        <h1 className="destacado__titulo">subir capítulos</h1>
        <span className="muted">
          al bucket <span className="narrow">{bucket}</span>, directo desde el navegador
        </span>
      </div>
      <p className="muted" style={{ maxWidth: 720, marginBottom: 18 }}>
        Sin límite de 300 MB: los archivos van del navegador a R2 sin pasar por el sitio. Nombrálos antes como los
        busca el sitio, <span className="narrow">s01e01.mp4</span> a <span className="narrow">s01e13.mp4</span> y{" "}
        <span className="narrow">s02e01.mp4</span> a <span className="narrow">s02e11.mp4</span>, o subilos con el nombre
        que tengan y después se adapta el sitio. Dejá la pestaña abierta hasta que termine.
      </p>

      <div
        className={`zona${arrastrando ? " zona--activa" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          if (e.dataTransfer.files.length) agregar(e.dataTransfer.files);
        }}
      >
        <p>Arrastrá acá los archivos, o</p>
        <button className="boton boton--acento" type="button" onClick={() => entrada.current?.click()}>
          elegir archivos
        </button>
        <input
          ref={entrada}
          type="file"
          multiple
          accept=".mp4,.m4v,.mov,.webm,.mkv,.avi,.vtt,.jpg,.jpeg,.png,video/*,text/vtt"
          hidden
          onChange={(e) => {
            if (e.target.files?.length) agregar(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <>
          <h2 className="seccion__titulo" style={{ marginTop: 26 }}>
            archivos
            <span className="num">
              {listos} listos{conError ? `, ${conError} con error` : ""}{activos ? `, ${activos} en curso` : ""}
            </span>
            {listos > 0 && activos === 0 && (
              <Link className="boton boton--chico" href="/estado" style={{ marginLeft: "auto" }}>
                ver el estado
              </Link>
            )}
          </h2>
          <ul className="subidas">
            {items.map((i) => {
              const esperado = esperadosSet.has(i.archivo.name);
              return (
                <li key={i.id} className="subida">
                  <div className="subida__fila">
                    <span className="narrow subida__nombre">{i.archivo.name}</span>
                    <span className="muted num">{peso(i.archivo.size)}</span>
                    <span
                      className={`chip ${
                        i.estado === "listo"
                          ? "chip--ok"
                          : i.estado === "error"
                            ? "chip--mal"
                            : i.estado === "cola"
                              ? "chip--falta"
                              : "chip--revisando"
                      }`}
                    >
                      {i.estado === "cola"
                        ? "en cola"
                        : i.estado === "pidiendo"
                          ? "preparando"
                          : i.estado === "subiendo"
                            ? `${i.pct}%`
                            : i.estado === "listo"
                              ? "subido"
                              : "error"}
                    </span>
                    {i.estado === "error" && (
                      <button
                        className="boton boton--chico"
                        type="button"
                        onClick={() => actualizar(i.id, { estado: "cola", pct: 0, mensaje: "", cors: false })}
                      >
                        reintentar
                      </button>
                    )}
                  </div>
                  {(i.estado === "subiendo" || i.estado === "listo") && (
                    <div className="progreso" aria-hidden="true">
                      <div className="progreso__lleno" style={{ width: `${i.pct}%` }} />
                    </div>
                  )}
                  {!esperado && i.estado !== "error" && (
                    <div className="detalle">
                      Ese nombre no coincide con ningún capítulo. Se sube igual; después hay que cambiar el campo key en
                      data/episodes.json o renombrarlo en el bucket.
                    </div>
                  )}
                  {i.mensaje && <div className="detalle">{i.mensaje}</div>}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <details className="cors" open={hayCors}>
        <summary>
          {hayCors ? "Falta la política CORS del bucket: así se carga" : "Antes de la primera subida: la política CORS del bucket"}
        </summary>
        <p className="muted" style={{ margin: "10px 0" }}>
          R2 sólo acepta subidas desde un navegador si el bucket tiene una política CORS que nombre a este sitio. Se
          carga una sola vez, en Cloudflare: <strong>R2 Object Storage</strong>, el bucket{" "}
          <span className="narrow">{bucket}</span>, pestaña <strong>Settings</strong>, sección{" "}
          <strong>CORS Policy</strong>, <strong>Add CORS policy</strong>. Pegá esto tal cual en el editor y guardá.
        </p>
        <pre className="codigo">{politicaCors(origen)}</pre>
        <button className="boton boton--chico" type="button" onClick={copiar}>
          {copiado ? "copiado" : "copiar la política"}
        </button>
      </details>
    </section>
  );
}
