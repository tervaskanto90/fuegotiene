import type { Metadata } from "next";
import Cabecera from "@/components/Cabecera";
import Juego from "@/components/Juego";
import { estadoPuerta } from "@/lib/pases";

export const metadata: Metadata = { title: "el juego" };

export default async function PaginaJuego({
  searchParams,
}: {
  searchParams: Promise<{ puerta?: string }>;
}) {
  // ?puerta=1 lo pone el middleware cuando alguien fue derecho a los
  // capítulos sin haber pasado: el cartel lo dice con todas las letras.
  const { puerta: vino } = await searchParams;
  const puerta = await estadoPuerta();
  return (
    <div className="contenedor">
      <Cabecera activa="juego" />
      <main>
        <Juego puerta={puerta} rebotado={vino === "1"} />
      </main>
    </div>
  );
}
