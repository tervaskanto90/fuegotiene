import type { Metadata } from "next";
import Cabecera from "@/components/Cabecera";
import Subida from "@/components/Subida";
import { episodios } from "@/lib/episodes";
import { leerR2 } from "@/lib/r2";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "subir" };

export default function PaginaSubir() {
  const r2 = leerR2();
  return (
    <div className="contenedor">
      <Cabecera activa="subir" />
      <main>
        <Subida
          modo={r2 ? "r2" : "demo"}
          bucket={r2?.bucket ?? null}
          esperados={episodios.flatMap((e) => [e.key, e.sub].filter(Boolean))}
        />
      </main>
    </div>
  );
}
