import type { Metadata } from "next";
import Cabecera from "@/components/Cabecera";
import Juego from "@/components/Juego";
import { estadoPuerta } from "@/lib/pases";

export const metadata: Metadata = { title: "el juego" };

export default async function PaginaJuego() {
  const puerta = await estadoPuerta();
  return (
    <div className="contenedor">
      <Cabecera activa="juego" />
      <main>
        <Juego puerta={puerta} />
      </main>
    </div>
  );
}
