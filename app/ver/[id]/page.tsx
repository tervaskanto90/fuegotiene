import type { Metadata } from "next";
import { notFound } from "next/navigation";
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

// El reproductor ocupa la ventana entera, como en las plataformas: sin
// cabecera ni márgenes. Volver es la flecha de arriba a la izquierda.
export default async function Ver({ params }: Props) {
  const { id } = await params;
  const ep = buscar(id);
  if (!ep) notFound();
  return (
    <main className="cine-pagina">
      <Reproductor ep={ep} sig={siguiente(id)} ant={anterior(id)} />
    </main>
  );
}
