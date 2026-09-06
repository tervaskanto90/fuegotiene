import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import Reproductor from "@/components/Reproductor";
import { anterior, buscar, codigo, episodios, siguiente } from "@/lib/episodes";

type Props = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return episodios.map((e) => ({ id: e.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const ep = buscar(id);
  return { title: ep ? `${codigo(ep)} ${ep.titulo}` : "capítulo" };
}

export default async function Ver({ params }: Props) {
  const { id } = await params;
  const ep = buscar(id);
  if (!ep) notFound();
  return (
    <div className="contenedor">
      <Cabecera activa="capitulos" />
      <main>
        <Reproductor ep={ep} sig={siguiente(id)} ant={anterior(id)} />
      </main>
    </div>
  );
}
