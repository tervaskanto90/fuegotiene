import Cabecera from "@/components/Cabecera";
import Biblioteca from "@/components/Biblioteca";
import { episodios } from "@/lib/episodes";

export default function Portada() {
  return (
    <div className="contenedor">
      <Cabecera activa="capitulos" />
      <main>
        <Biblioteca episodios={episodios} />
      </main>
    </div>
  );
}
