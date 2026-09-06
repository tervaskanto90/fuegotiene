import type { Metadata } from "next";
import Cabecera from "@/components/Cabecera";
import Estado from "@/components/Estado";
import { leerConfig } from "@/lib/auth";
import { episodios } from "@/lib/episodes";
import { faltantesR2, leerR2 } from "@/lib/r2";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "estado" };

export default function PaginaEstado() {
  const auth = leerConfig();
  const r2 = leerR2();
  const faltan = faltantesR2();

  return (
    <div className="contenedor">
      <Cabecera activa="estado" />
      <main>
        <section className="resumen">
          <h2 className="seccion__titulo" style={{ marginBottom: 4 }}>
            configuración
          </h2>
          <dl>
            <dt>acceso</dt>
            <dd>
              {auth.ok ? (
                <>
                  <span className="mint">bien</span>: {auth.config.codigos.length}{" "}
                  {auth.config.codigos.length === 1 ? "código cargado" : "códigos cargados"}
                </>
              ) : (
                auth.problema
              )}
            </dd>
            <dt>archivos</dt>
            <dd>
              {r2 ? (
                <>
                  <span className="mint">R2 configurado</span>, bucket <code className="narrow">{r2.bucket}</code>. Abajo dice si
                  responde.
                </>
              ) : (
                <>
                  modo demo con el clip de muestra. Para conectar R2 faltan en Vercel:{" "}
                  <code className="narrow">{faltan.join(", ")}</code>
                </>
              )}
            </dd>
          </dl>
        </section>
        <Estado episodios={episodios} modo={r2 ? "r2" : "demo"} />
      </main>
    </div>
  );
}
