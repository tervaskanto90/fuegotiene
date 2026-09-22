import type { Metadata } from "next";
import Cabecera from "@/components/Cabecera";
import Juego from "@/components/Juego";

export const metadata: Metadata = { title: "el juego" };

export default function PaginaJuego() {
  return (
    <div className="contenedor">
      <Cabecera activa="juego" />
      <main>
        <Juego />
      </main>
    </div>
  );
}
